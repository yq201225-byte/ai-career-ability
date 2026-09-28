const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const results = [];
const errors = [];
let page;
const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
const fill = (field, value) => page.locator(`[data-field="${field}"]`).fill(value);
const select = (field, value) => page.locator(`[data-field="${field}"]`).selectOption(value);
const stored = key => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null'), key);

async function check(name, run) {
  await run();
  results.push(name);
  console.log(`PASS ${name}`);
}
async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await click('skip-goal');
  await click('nav', '[data-route="portfolio"]');
  await click('open-experiences');
  await click('new-experience');
  return context;
}
async function fillValidExperience() {
  await fill('experienceTitle', '知识库问答需求整理');
  await select('experienceRole', '参与');
  await fill('experienceWork', '整理用户访谈中的高频问题，并归纳首轮澄清需求。');
  await fill('experienceDeliverable', '访谈问题清单和需求说明初稿。');
  await select('experienceResult', '暂无可量化结果');
  await fill('experienceCollaboration', '我负责整理和初稿，产品与研发共同评审。');
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  let context;
  try {
    context = await fresh(browser);
    await check('纯数字不能保存为经历', async () => {
      await fill('experienceTitle', '1');
      await fill('experienceWork', '1');
      await fill('experienceDeliverable', '1');
      await fill('experienceCollaboration', '1');
      await click('save-experience');
      assert.match(await page.locator('.expression-warning').innerText(), /不能只填数字/);
      assert.equal((await stored('portfolioExperiences')).length, 0);
    });
    await check('完整经历可以保存并保留原始字段', async () => {
      await fillValidExperience();
      await click('save-experience');
      const records = await stored('portfolioExperiences');
      assert.equal(records.length, 1);
      assert.equal(records[0].result, '暂无可量化结果');
      assert.match(await page.locator('.source-card').innerText(), /知识库问答需求整理/);
    });
    await check('材料只在用户说明后显示，不伪装成已验证', async () => {
      await click('edit-experience');
      await select('experienceMaterialType', 'document');
      await fill('experienceMaterialDetail', '需求说明文档第 2 版。');
      await click('save-experience');
      const text = await page.locator('.source-card').innerText();
      assert.match(text, /材料：文档/);
      assert.doesNotMatch(text, /已关联材料|已验证|已证明/);
    });
    await check('经历可直接进入草稿，不经过候选表达卡', async () => {
      await click('portfolio-drafts');
      await click('new-portfolio-draft');
      await click('choose-draft-source');
      assert.equal(await page.locator('[data-field="portfolioDraftBody"]').count(), 1);
      assert.equal(await page.locator('[data-action="claim-approve"]').count(), 0);
      await page.screenshot({ path: path.join(process.env.TEMP, 'ai-career-portfolio-v2-mobile.png'), fullPage: true });
    });
    await check('草稿会提示职责放大和无依据结果', async () => {
      await fill('portfolioDraftBody', '我主导了全部工作，并显著提升转化率。');
      await click('review-portfolio-draft');
      const warning = await page.locator('.expression-warning').innerText();
      assert.match(warning, /职责范围/);
      assert.match(warning, /量化结果/);
    });
    await check('通过检查的草稿可保存，删除经历不删除草稿', async () => {
      await fill('portfolioDraftBody', '在“知识库问答需求整理”中，我整理用户访谈中的高频问题，并归纳首轮澄清需求。\n\n我交付了：访谈问题清单和需求说明初稿。\n\n本次未补充可量化结果。\n\n协作范围：我负责整理和初稿，产品与研发共同评审。');
      await click('review-portfolio-draft');
      assert.equal(await page.locator('.expression-warning').count(), 0);
      await page.locator('[data-field="portfolioDeclaration"]').check();
      await click('save-portfolio-draft');
      assert.equal((await stored('portfolioDrafts')).length, 1);
      await page.reload();
      assert.equal(await page.locator('[data-action="new-portfolio-draft"]').count(), 1);
      await click('open-experiences');
      await click('delete-experience');
      await click('confirm-delete');
      assert.equal((await stored('portfolioExperiences')).length, 0);
      assert.equal((await stored('portfolioDrafts')).length, 1);
    });
    await check('个人训练案例在草稿里保留身份标签', async () => {
      await context.close();
      context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => sessionStorage.setItem('trainingCases', JSON.stringify([{ id: 'training-1', title: 'AI 问答方案训练', submissions: ['完成问题判断和状态设计'], deliverable: '训练提交与反馈记录' }])));
      await page.goto(url);
      await click('skip-goal');
      await click('nav', '[data-route="portfolio"]');
      await click('portfolio-drafts');
      await click('new-portfolio-draft');
      await click('choose-draft-source', '[data-index="0"]');
      // The first available source after deleting the experience is the training case.
      assert.match(await page.locator('.answer-label').innerText(), /个人训练案例/);
      await fill('portfolioDraftTitle', '我的项目');
      await fill('portfolioDraftBody', '我完成了一次训练。');
      await click('review-portfolio-draft');
      assert.match(await page.locator('.expression-warning').innerText(), /个人训练案例/);
    });
    assert.deepEqual(errors, []);
    console.log(`\n${results.length} portfolio checks passed.`);
  } finally {
    await context?.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
