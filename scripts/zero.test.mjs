import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const gmail = readFileSync(new URL('../content/zero-gmail.js', import.meta.url), 'utf8');
function reading({hash = '#inbox', range = '1–50 of 123', empty = '', categories = false, hidden = false, sections = null} = {}) {
  let listener;
  const el = text => ({textContent:text, getClientRects:() => hidden ? [] : [1], getAttribute:() => null});
  const headers = (sections || []).map(({name,range,empty}) => ({...el(''),
    querySelector:() => el(name), querySelectorAll:() => range ? [el(range)] : [],
    parentElement:{querySelectorAll:() => empty ? [el(empty)] : []}}));
  const main = {...el(''), querySelectorAll:selector => selector === '.Wg' ? headers : selector.includes('tab') ? (categories ? [el('Primary')] : []) : [el(empty)]};
  const document = {documentElement: {}, querySelectorAll: selector => selector === '[role="main"]' ? [main] : [el(range)]};
  const context = {document, location:{hash}, getComputedStyle:() => ({visibility:'visible'}), MutationObserver: class { observe() {} },
    window:{addEventListener() {}}, browser:{runtime:{onMessage:{addListener(fn) { listener=fn; }}}}, clearTimeout, setTimeout};
  vm.runInNewContext(gmail, context);
  return listener({type:'supern-zero-read-inbox'});
}
test('Inbox totals include read mail and pagination; never use unread badges', async () => {
  for (const [range,count] of [['1–50 of 123',123],['51–100 of 1,234',1234],['1–1 of 1',1],['1–50 de 1.234',1234],['1 – 50 of 1 234',1234]]) {
    assert.equal((await reading({range})).count,count,range);
  }
});
test('Missing, approximate, invalid, hidden, and other views are unavailable', async () => {
  for (const opts of [{range:''},{range:'Inbox (12)'},{range:'1–50 of about 123'},{range:'1–50 of 20'},{hash:'#sent'},{hash:'#inbox/threadid'},{hidden:true},{categories:true}]) {
    assert.equal((await reading(opts)).available,false,JSON.stringify(opts));
  }
});
test('Only an explicit empty Inbox becomes zero', async () => {
  assert.equal((await reading({range:'',empty:'Your inbox is empty.'})).count,0);
  assert.equal((await reading({range:'',empty:''})).available,false);
});
test('Three pinned tabs globally, extra pinned tabs count, private tabs excluded', () => {
  const source = readFileSync(new URL('../background.js', import.meta.url),'utf8');
  const fn = source.slice(source.indexOf('function zeroTabCount('), source.indexOf('\nfunction zeroSync()'));
  const context = {}; vm.runInNewContext(fn,context);
  assert.equal(context.zeroTabCount([{pinned:true},{pinned:true},{pinned:true},{pinned:true},{pinned:false},{incognito:true}]),2);
  assert.equal(context.zeroTabCount([{pinned:true},{pinned:false}]),1);
  assert.equal(context.zeroTabCount([]),0);
});

test('Unread first adds both sections, including explicit empty unread section', async () => {
  assert.equal((await reading({sections:[{name:'Unread',empty:"Woohoo! You've read all the messages in your inbox."},{name:'Everything else',range:'1–3 of 3'}]})).count,3);
  assert.equal((await reading({sections:[{name:'Unread',range:'1–2 of 2'},{name:'Everything else',range:'1–3 of 3'}]})).count,5);
  assert.equal((await reading({sections:[{name:'Unread'},{name:'Everything else',range:'1–3 of 3'}]})).available,false);
  assert.equal((await reading({sections:[{name:'Unread',range:'1–3 of 3'},{name:'Everything else',range:'1–3 of 3'}]})).count,6);
});
