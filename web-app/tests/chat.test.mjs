import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validPushSubscription,isUuid} from '../src/lib/chat.ts';
const subscription=endpoint=>({endpoint,keys:{p256dh:'A'.repeat(87),auth:'B'.repeat(22)}});
test('push endpoints cannot target private networks or attacker domains',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/push','https://localhost/push','https://127.0.0.1/push','https://169.254.169.254/latest','https://fcm.googleapis.com.attacker.example/push','https://evilpush.apple.com/push','https://fcm.googleapis.com:8443/push','https://u:p@fcm.googleapis.com/push'])assert.equal(validPushSubscription(subscription(endpoint)),false,endpoint);
 for(const endpoint of ['https://fcm.googleapis.com/fcm/send/example','https://web.push.apple.com/example','https://updates.push.services.mozilla.com/wpush/v2/example','https://wns2.notify.windows.com/example'])assert.equal(validPushSubscription(subscription(endpoint)),true,endpoint);
 assert.equal(validPushSubscription({endpoint:'https://fcm.googleapis.com',keys:{p256dh:'short',auth:'short'}}),false);
});
test('conversation ids reject query injection and missing identifiers',()=>{
 assert.equal(isUuid('6c4a7fcf-4434-41e8-ac87-15fb7550d17f'),true);
 for(const id of [null,'','not-a-uuid','6c4a7fcf-4434-41e8-ac87-15fb7550d17f&admin=true'])assert.equal(isUuid(id),false);
});
