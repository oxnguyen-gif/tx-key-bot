const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_USERNAME = '@Saligan2';

const BANK = {
  bankName: 'MB Bank',
  account: '90891232009',
  owner: 'NGUYEN VAN QUANG ANH'
};

const PRODUCTS = [
  { id: 'day1',    label: '1 ngày',    days: 1,   price: 5000,   prefix: 'DAY' },
  { id: 'month1',  label: '30 ngày',   days: 30,  price: 49000,  prefix: 'MONTH' },
  { id: 'year1',   label: '365 ngày',  days: 365, price: 449000, prefix: 'YEAR' },
  { id: 'forever', label: 'Vĩnh viễn', days: 0,   price: 799000, prefix: 'VIP' }
];

const KEY_SECRET = 'SKIDVN2026X';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const orders = {};
let orderCounter = 1000;

function genKeyHash(str){
  let h = 5381;
  for (let i = 0; i < str.length; i++){
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).toUpperCase().padStart(6, '0').slice(-4);
}

function randomStr(len){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function createKey(prefix, days){
  const rand = randomStr(8);
  const sig = genKeyHash(prefix + '-' + days + '-' + rand + KEY_SECRET);
  return prefix + '-' + days + '-' + rand + '-' + sig;
}

function formatMoney(n){
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
}

function mainMenu(chatId){
  bot.sendMessage(chatId,
    '👋 Chào bạn! Bot bán key TX Predictor.\n\n' +
    '📦 /menu - Xem sản phẩm\n' +
    '💰 /price - Bảng giá\n' +
    '📞 /support - Liên hệ admin\n' +
    '📋 /myorders - Đơn của bạn'
  );
}

function productMenu(chatId){
  const buttons = PRODUCTS.map(p => [{
    text: p.label + ' — ' + formatMoney(p.price),
    callback_data: 'buy_' + p.id
  }]);
  bot.sendMessage(chatId, '🎯 Chọn loại key bạn muốn mua:', {
    reply_markup: { inline_keyboard: buttons }
  });
}

bot.onText(/\/start/, (msg) => mainMenu(msg.chat.id));
bot.onText(/\/menu/, (msg) => productMenu(msg.chat.id));
bot.onText(/\/help/, (msg) => mainMenu(msg.chat.id));

bot.onText(/\/price/, (msg) => {
  let txt = '💰 BẢNG GIÁ KEY TX\n\n';
  PRODUCTS.forEach(p => { txt += '• ' + p.label + ': ' + formatMoney(p.price) + '\n'; });
  txt += '\nBấm /menu để mua ngay!';
  bot.sendMessage(msg.chat.id, txt);
});

bot.onText(/\/support/, (msg) => {
  bot.sendMessage(msg.chat.id,
    '📞 Liên hệ hỗ trợ:\n\nTelegram: ' + ADMIN_USERNAME + '\n\nNhắn tin để được hỗ trợ.'
  );
});

bot.onText(/\/myorders/, (msg) => {
  const chatId = msg.chat.id;
  const myOrders = Object.values(orders).filter(o => o.chatId === chatId);
  if (!myOrders.length) return bot.sendMessage(chatId, '📭 Bạn chưa có đơn hàng nào.');
  let txt = '📋 Đơn hàng của bạn:\n\n';
  myOrders.slice(-10).forEach(o => {
    const status = o.status === 'paid' ? '✅ Đã thanh toán' :
                   o.status === 'pending' ? '⏳ Chờ thanh toán' :
                   o.status === 'cancelled' ? '❌ Đã hủy' : '⏳ Chờ xác nhận';
    txt += '• Đơn #' + o.id + '\n';
    txt += '  ' + o.product.label + ' — ' + formatMoney(o.product.price) + '\n';
    txt += '  Trạng thái: ' + status + '\n';
    if (o.status === 'paid' && o.key) txt += '  🔑 Key: ' + o.key + '\n';
    txt += '\n';
  });
  bot.sendMessage(chatId, txt);
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const parts = data.split('_');
  const action = parts[0];

  if (action === 'buy'){
    const pid = parts[1];
    const product = PRODUCTS.find(p => p.id === pid);
    if (!product) return bot.answerCallbackQuery(query.id, { text: 'Lỗi sản phẩm' });

    orderCounter++;
    const code = 'TX' + orderCounter;
    orders[orderCounter] = {
      id: orderCounter,
      chatId: chatId,
      username: query.from.username || query.from.first_name || 'user',
      product: product,
      code: code,
      status: 'pending',
      createdAt: Date.now()
    };

    const txt =
      '📦 Đơn hàng #' + orderCounter + '\n\n' +
      '🎯 Sản phẩm: ' + product.label + '\n' +
      '💰 Số tiền: ' + formatMoney(product.price) + '\n\n' +
      '━━━━━━━━━━━━━━━\n' +
      '🏦 THÔNG TIN CHUYỂN KHOẢN\n' +
      '━━━━━━━━━━━━━━━\n' +
      'Ngân hàng: ' + BANK.bankName + '\n' +
      'Số TK: ' + BANK.account + '\n' +
      'Chủ TK: ' + BANK.owner + '\n' +
      'Số tiền: ' + formatMoney(product.price) + '\n' +
      'Nội dung: ' + code + '\n' +
      '━━━━━━━━━━━━━━━\n\n' +
      '⚠️ Nhập ĐÚNG nội dung để bot xác nhận.\n\n' +
      'Sau khi CK xong, bấm nút bên dưới:';

    bot.sendMessage(chatId, txt, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Tôi đã chuyển khoản', callback_data: 'paid_' + orderCounter }],
          [{ text: '❌ Hủy đơn', callback_data: 'cancel_' + orderCounter }]
        ]
      }
    });
    return bot.answerCallbackQuery(query.id);
  }

  if (action === 'paid'){
    const id = +parts[1];
    const o = orders[id];
    if (!o) return bot.answerCallbackQuery(query.id, { text: 'Đơn không tồn tại' });
    if (o.status !== 'pending') return bot.answerCallbackQuery(query.id, { text: 'Đơn đã xử lý' });

    o.status = 'waiting_confirm';
    bot.sendMessage(chatId,
      '⏳ Đã ghi nhận!\n\nAdmin sẽ kiểm tra và xác nhận trong 1-5 phút.\nVui lòng chờ key gửi về đây.'
    );
    notifyAdmin(o);
    return bot.answerCallbackQuery(query.id, { text: 'Đã gửi admin' });
  }

  if (action === 'cancel'){
    const id = +parts[1];
    const o = orders[id];
    if (!o) return bot.answerCallbackQuery(query.id, { text: 'Đơn không tồn tại' });
    o.status = 'cancelled';
    bot.sendMessage(chatId, '❌ Đã hủy đơn #' + id);
    return bot.answerCallbackQuery(query.id);
  }

  if (action === 'confirm'){
    const id = +parts[1];
    const o = orders[id];
    if (!o) return bot.answerCallbackQuery(query.id, { text: 'Đơn không tồn tại' });
    if (o.status === 'paid') return bot.answerCallbackQuery(query.id, { text: 'Đã xác nhận rồi' });

    const key = createKey(o.product.prefix, o.product.days);
    o.key = key;
    o.status = 'paid';
    o.paidAt = Date.now();

    const link = 'https://tolmoimatto.netlify.app/#key=' + key;
    bot.sendMessage(o.chatId,
      '🎉 THANH TOÁN THÀNH CÔNG!\n\n' +
      '📦 Đơn hàng: #' + o.id + '\n' +
      '🎯 Sản phẩm: ' + o.product.label + '\n\n' +
      '🔑 KEY CỦA BẠN:\n' + key + '\n\n' +
      '🔗 Bấm link để dùng ngay:\n' + link + '\n\n' +
      'Hoặc mở web và nhập key thủ công.\n\n' +
      '💡 Nếu key không hoạt động, liên hệ ' + ADMIN_USERNAME
    );

    bot.sendMessage(query.message.chat.id,
      '✅ Đã xác nhận đơn #' + o.id + '\n\n' +
      '👤 Khách: @' + o.username + '\n' +
      '📦 ' + o.product.label + ' — ' + formatMoney(o.product.price) + '\n' +
      '🔑 Key: ' + key + '\n\n' +
      'Đã gửi key cho khách.'
    );

    return bot.answerCallbackQuery(query.id, { text: '✅ Đã gửi key' });
  }

  if (action === 'reject'){
    const id = +parts[1];
    const o = orders[id];
    if (!o) return bot.answerCallbackQuery(query.id, { text: 'Đơn không tồn tại' });
    o.status = 'cancelled';
    bot.sendMessage(o.chatId,
      '❌ Đơn #' + o.id + ' đã bị hủy\n\nLý do: Admin chưa nhận được thanh toán.\nNếu bạn đã CK, liên hệ ' + ADMIN_USERNAME
    );
    return bot.answerCallbackQuery(query.id, { text: 'Đã hủy' });
  }

  bot.answerCallbackQuery(query.id);
});

function notifyAdmin(order){
  const txt =
    '🔔 ĐƠN HÀNG MỚI CẦN XÁC NHẬN\n\n' +
    '📦 Đơn: #' + order.id + '\n' +
    '👤 Khách: @' + order.username + '\n' +
    '🎯 Sản phẩm: ' + order.product.label + '\n' +
    '💰 Số tiền: ' + formatMoney(order.product.price) + '\n' +
    '📝 Nội dung CK: ' + order.code + '\n\n' +
    '👆 Kiểm tra TK, nếu có tiền vào thì bấm ✅';

  bot.sendMessage(ADMIN_USERNAME, txt, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Xác nhận & gửi key', callback_data: 'confirm_' + order.id },
          { text: '❌ Hủy', callback_data: 'reject_' + order.id }
        ]
      ]
    }
  }).catch(err => {
    console.error('Không gửi được cho admin:', err.message);
    console.error('→ Admin phải /start bot trước!');
  });
}

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

console.log('🤖 Bot TX Key Shop đang chạy...');
console.log('👤 Admin:', ADMIN_USERNAME);
console.log('🏦 Bank:', BANK.bankName, BANK.account);