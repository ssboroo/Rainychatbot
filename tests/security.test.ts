import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhook, hashPassword, checkPassword, requireSameOrigin, id } from '../src/lib/security';
test('webhook accepts authentic V2 bytes and rejects tamper, stale/future attempts and malformed timestamps',()=>{
 const secret='unit-test-secret',raw='{"event":"dm.received","data":{"id":"one"}}',now=1750000000000,ts=String(now/1000);
 const sign=(time:string,body:string)=>'sha256='+createHmac('sha256',secret).update(time+'.'+body).digest('hex');
 assert.equal(verifyWebhook(secret,raw,ts,sign(ts,raw),now),true);
 assert.equal(verifyWebhook(secret,raw+' ',ts,sign(ts,raw),now),false);
 for(const timestamp of [String(now/1000-301),String(now/1000+301),'NaN',''])assert.equal(verifyWebhook(secret,raw,timestamp,sign(timestamp,raw),now),false);
 assert.equal(verifyWebhook(secret,raw,ts,'short',now),false);
 assert.equal(verifyWebhook('',raw,ts,sign(ts,raw),now),false);
});
test('passwords are salted and constant-time verified, malformed stored hashes fail closed',()=>{const a=hashPassword('long-test-password'),b=hashPassword('long-test-password');assert.notEqual(a,b);assert.equal(checkPassword('long-test-password',a),true);assert.equal(checkPassword('wrong-password',a),false);assert.equal(checkPassword('x','bad-data'),false)});
test('state-changing requests require the exact configured Origin',()=>{process.env.APP_URL='https://rainy.example';assert.doesNotThrow(()=>requireSameOrigin(new Request('https://internal/action',{headers:{Origin:'https://rainy.example'}})));for(const origin of ['https://evil.example','https://rainy.example.evil.example','null'])assert.throws(()=>requireSameOrigin(new Request('https://internal/action',{headers:{Origin:origin}})));assert.throws(()=>requireSameOrigin(new Request('https://internal/action')))});
test('opaque IDs cannot inject query strings or path segments',()=>{assert.equal(id('../other?brand_id=foreign'),'..%2Fother%3Fbrand_id%3Dforeign');assert.throws(()=>id(''));assert.throws(()=>id('a\n'))});
