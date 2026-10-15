// chatsDb.js aur messagesDb.js dono "telebook.db" naam ki SQLite file kholte
// hain — expo-sqlite same naam ke liye SAME underlying native connection
// deta hai (dedupe). Ek connection par ek waqt me sirf EK transaction chal
// sakta hai; do jagah se (jaise chat-list sync aur message cache) same waqt
// `db.withTransactionAsync()` call hone par native layer
// "cannot start a transaction within a transaction" / "cannot rollback - no
// transaction is active" deta hai aur woh write chup-chaap gir jaata hai
// (sirf console.log hota hai, data save hi nahi hota).
//
// Yeh ek simple FIFO queue hai — chahe call chatsDb.js se aaye ya
// messagesDb.js se, sab ek-ek karke, kabhi overlap na karte hue chalte hain.
let tail = Promise.resolve();

export const serializeDbWrite = (fn) => {
    const run = tail.then(fn, fn); // pichla job fail bhi hua ho to agla phir bhi chale
    tail = run.then(() => {}, () => {}); // chain kabhi reject state me na atke
    return run;
};
