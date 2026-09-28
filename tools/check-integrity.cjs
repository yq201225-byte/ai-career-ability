const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const results = [];
const errors = [];
let page;
async function check(name, run) {
  await run();
  results.push({ name, result: 'PASS' });
  console.log('PASS', name);
}
const click = (action, extra = '') => page.locator(`[data-action="${action}"]${extra}`).first().click();
const fill = (field, value) => page.locator(`[data-field="${field}"]`).fill(value);
const stored = key => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null'), key);
async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await click('skip-goal');
  return context;
}
async function openAsset(name) {
  await click('nav', '[data-route="me"]');
  await click('open-asset', `[data-asset="${name}"]`);
}
async function experience(answers) {
  await click('nav', '[data-route="portfolio"]');
  await click('start-claim-workbench', '[data-mode="experience"]');
  for (const answer of answers) { await fill('claimDraft', answer); await click('claim-submit'); }
}
async function editClaim(statement) {
  await click('claim-edit', '[data-index="0"]');
  await fill('claimStatement', statement);
  await fill('claimWording', statement);
  await page.locator('[data-field="claimRole"]').selectOption('参与');
  await click('save-claim');
}
async function saveReviewedDraft() {
  await click('review-candidate-draft');
  assert.equal((await page.locator('.expression-warning').count()), 0);
  await page.locator('[data-field="userDeclaration"]').check();
  await click('save-candidate-draft');
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
  try {
    let context = await fresh(browser);
    await click('nav', '[data-route="practice"]');
    await check('不同主题进入对应任务', async () => {
      await click('choose-composite-theme', '[data-case-id="workflow"]');
      assert.match(await page.locator('.task-context').first().innerText(), /复杂需求/);
      await click('back');
    });
    await click('choose-composite-theme', '[data-case-id="knowledge"]');
    await check('实操不足提交保留原文与反馈', async () => {
      await fill('compositeResponse', '不知道'); await click('composite-submit');
      assert.equal(await page.locator('[data-action="composite-next"]').count(), 0);
      await page.locator('.process-history summary').click();
      assert.match(await page.locator('.process-history').innerText(), /不知道/);
    });
    const response = '目标用户是刚转岗的同学，核心问题是不知道如何提问，场景是在首次使用时补充问题。';
    await fill('compositeResponse', response); await click('composite-submit');
    await check('检查后修改必须重新提交', async () => {
      await fill('compositeResponse', response + '需要进一步明确问题。');
      assert.equal(await page.locator('[data-action="composite-next"]').count(), 0);
      await click('composite-submit'); await click('composite-next');
    });
    await check('中途刷新保留步骤与全部提交', async () => {
      await page.reload();
      assert.match(await page.locator('.task-context').last().innerText(), /明确问题/);
      assert.equal((await stored('aiCareer.session.v04')).practice.attempts.length, 3);
    });
    for (const text of ['明确问题直接回答，模糊问题先追问，无法判断时提供兜底提示让用户补充资料。', '测试场景一是问题不完整，观察是否追问；测试场景二是没有资料，观察兜底提示。']) {
      await fill('compositeResponse', text); await click('composite-submit'); await click('composite-next');
    }
    await check('完成后可回看五次提交及失败反馈', async () => {
      const record = (await stored('trainingCases'))[0];
      assert.equal(record.attempts.length, 5);
      assert.equal(record.attempts[0].feedback.passed, false);
      await openAsset('trainingCase'); await click('view-asset-record');
      await page.locator('.process-history summary').click();
      assert.equal(await page.locator('.process-history article').count(), 5);
      await page.reload();
      assert.equal(await page.locator('.process-history article').count(), 5);
      await page.locator('.process-history summary').click();
      await page.screenshot({ path: path.join(process.env.TEMP, 'career-practice-history-mobile.png'), fullPage: true });
    });
    const originalCase = JSON.stringify((await stored('trainingCases'))[0]);
    await click('back');
    await click('back');
    await click('nav', '[data-route="portfolio"]');
    await click('start-claim-workbench', '[data-mode="training"]');
    await click('claim-approve', '[data-index="0"]'); await click('open-candidate-draft');
    await check('训练案例不能去掉身份标签', async () => {
      await fill('candidateDraftTitle', '我的项目');
      await click('review-candidate-draft');
      assert.match(await page.locator('.expression-warning').innerText(), /训练案例/);
    });
    await check('训练案例商业包装被拦截', async () => {
      await fill('candidateDraftTitle', '个人训练案例');
      await fill('candidateDraftBody', '为客户交付商业项目并完成上线。');
      await click('review-candidate-draft');
      assert.match(await page.locator('.expression-warning').innerText(), /商业|上线/);
      await fill('candidateDraftBody', '围绕问答场景完成个人训练案例，记录自己的判断。');
      await saveReviewedDraft();
      assert.equal(JSON.stringify((await stored('trainingCases'))[0]), originalCase);
      assert.equal((await stored('portfolioDrafts'))[0].claimSnapshots[0].sourceTrainingCaseId, JSON.parse(originalCase).id);
    });
    await check('训练案例草稿可返回原训练过程', async () => {
      await openAsset('draft'); await click('view-draft-version'); await click('view-training-source');
      assert.equal(await page.locator('.process-history article').count(), 5);
      assert.match(await page.locator('.record-detail').innerText(), /5 次提交/);
    });
    await check('新标签页与重新开始均为空白体验', async () => {
      const second = await context.newPage(); await second.goto(url);
      assert.equal(await second.locator('[data-action="skip-goal"]').count(), 1);
      assert.equal(await second.evaluate(() => sessionStorage.getItem('trainingCases')), null);
      await second.close();
      await click('restart-demo'); await click('confirm-restart-demo');
      assert.equal((await stored('trainingCases')).length, 0);
      assert.equal((await stored('portfolioDrafts')).length, 0);
      await click('skip-goal');
    });
    await experience(['我主导整个项目', '我整理了需求说明', '暂无数据', '同事负责开发，我参与需求梳理', '需求文档说明']);
    await check('初始主张中的主导措辞被识别', async () => {
      assert.equal(await page.locator('[data-action="claim-approve"][data-index="0"]').isDisabled(), true);
    });
    await check('降低表述后重新评估并可确认', async () => {
      await editClaim('我参与需求访谈，整理了需求说明。');
      assert.equal(await page.locator('[data-action="claim-approve"][data-index="0"]').isEnabled(), true);
      await click('claim-approve', '[data-index="0"]');
    });
    await check('已确认主张修改为主导后撤销确认', async () => {
      await editClaim('我主导整个项目并全权负责。');
      assert.equal(await page.locator('[data-action="claim-approve"][data-index="0"]').isDisabled(), true);
      assert.equal((await stored('portfolioClaims'))[0].approved, false);
      await editClaim('我参与需求访谈，整理了需求说明。');
      await click('claim-approve', '[data-index="0"]');
      await click('open-candidate-draft');
    });
    await check('草稿新增高风险内容不能保存', async () => {
      await fill('candidateDraftBody', '我主导整个项目。');
      await click('review-candidate-draft');
      assert.match(await page.locator('.expression-warning').innerText(), /主导/);
      await page.locator('[data-field="userDeclaration"]').check();
      await click('save-candidate-draft');
      assert.equal((await stored('portfolioDrafts')).length, 0);
    });
    await check('草稿修改后必须重新核对', async () => {
      await fill('candidateDraftBody', '我参与需求访谈，整理了需求说明和访谈问题。');
      await click('review-candidate-draft');
      await page.locator('[data-field="userDeclaration"]').check();
      await fill('candidateDraftBody', '我参与需求访谈，整理了需求说明与问题清单。');
      assert.equal(await page.locator('[data-field="userDeclaration"]').isChecked(), false);
      await click('save-candidate-draft');
      assert.equal((await stored('portfolioDrafts')).length, 0);
      await saveReviewedDraft();
    });
    const version = (await stored('portfolioDrafts'))[0];
    await check('来源与用户改动分别保存且刷新可回看', async () => {
      assert.equal(version.changes.length, 1);
      assert.match(version.claimSnapshots[0].statement, /需求说明/);
      assert.notEqual(version.changes[0].after, version.changes[0].before);
      await openAsset('draft'); await click('view-draft-version');
      await page.reload();
      assert.match(await page.locator('.fact-reference').innerText(), /需求说明/);
      await page.locator('.process-history summary').click();
      assert.match(await page.locator('.process-history').innerText(), /问题清单/);
      assert.doesNotMatch(await page.locator('.fact-reference').innerText(), /linked|unreviewed|user_statement/);
      await page.screenshot({ path: path.join(process.env.TEMP, 'career-draft-review-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(process.env.TEMP, 'career-draft-review-desktop.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await click('back'); await click('back');
    await click('nav', '[data-route="portfolio"]'); await click('open-claim-review');
    await editClaim('我参与梳理需求范围，补充了访谈记录。');
    await check('后改主张不改变已保存版本', async () => {
      assert.deepEqual((await stored('portfolioDrafts'))[0], version);
      await click('back'); await click('nav', '[data-route="me"]');
      await click('open-asset', '[data-asset="draft"]'); await click('view-draft-version');
      await click('edit-draft-version');
      await fill('candidateDraftTitle', '我的经历表达第二版');
      await saveReviewedDraft();
      const versions = await stored('portfolioDrafts');
      assert.equal(versions.length, 2); assert.equal(versions[0].basedOn, version.id);
      assert.deepEqual(versions[1], version);
    });
    await context.close();
    context = await fresh(browser);
    await click('ask-rag'); await click('start-practice');
    await check('普通实操同样保存失败与后续提交', async () => {
      await fill('practiceResponse', '不知道'); await click('practice-submit');
      for (const text of ['先确认问题是否明确，以及资料来源是否适合这次问题。', '资料不足时需要说明信息缺口，并邀请用户补充问题。', '完成以后保存学习记录，并用小测检查当前理解。']) {
        await fill('practiceResponse', text); await click('practice-submit'); await click('practice-next');
      }
      const record = (await stored('workRecords'))[0];
      assert.equal(record.attempts.length, 4);
      await openAsset('practice'); await click('view-asset-record');
      assert.equal(await page.locator('.process-history article').count(), 4);
    });
    await context.close();
    context = await fresh(browser);
    await fill('homeDraft', 'function decide(ready) { if (ready) return "go"; return "wait"; }'); await click('ask');
    await click('create-code-training'); await click('continue-code');
    await click('complete-training-step'); await click('fill-select', '[data-index="1"]'); await click('complete-training-step');
    await click('sort-move', '[data-index="0"][data-direction="down"]');
    await click('sort-move', '[data-index="1"][data-direction="down"]'); await click('complete-training-step');
    await fill('imitate', 'if (ready) return "go";'); await click('check-imitate');
    await check('第五步保存理解摘要并保留来源代码', async () => {
      for (const name of ['input', 'condition', 'outcome']) await page.locator(`[data-summary-slot="${name}"]`).selectOption('0');
      await fill('understandingSummary', '先看是否准备好，准备好就继续，否则等待。');
      await click('submit-summary');
      assert.match(await page.locator('.answer-title').innerText(), /理解摘要已完成/);
      await click('save-code-record'); await click('view-code-record');
      await page.reload();
      assert.match(await page.locator('.record-detail').innerText(), /否则等待/);
      await click('resume-viewed-code-record');
      assert.match(await page.locator('.code-panel').innerText(), /function decide/);
    });
    await check('手机与桌面排版、页面文案与脚本检查', async () => {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.doesNotMatch(await page.locator('body').innerText(), /本轮修改|本次将|受控\s*Demo|不假装|模拟\s*AI/);
      assert.deepEqual(errors, []);
    });
    await context.close();
    console.log(JSON.stringify({ total: results.length, results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
