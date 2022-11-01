let body = new ELEM(document.body);


let SearchBar = new (function(){
    let params = new URLSearchParams(window.location.search);
    this.params = params;
    let pathname =  window.location.pathname;
    let that = this;
    this.query = new Proxy({},{
        get(target, prop, receiver){
            return params.get(prop);
        },
        set(target, prop, value){
            params.set(prop,value);
            that.update();
        },
        has(target, prop){
            return prop in params;
        },
        ownKeys(target) {
            return [...params.entries()].map(e=>e[0]);
        },
        getOwnPropertyDescriptor(target, key) {
            return { enumerable: true, configurable: true, value: params.get(key) };
        }
    });
    this.update = function(){
        if (history.pushState) {
            window.history.replaceState(null,null,this.toString());
        }else{
            window.location.href = newurl;
        }
    }
    this.toString = function(){
        return window.location.protocol + "//" + window.location.host + pathname + "?" + params.toString();
    }
    this.reload = function(){
        window.location.href = this.toString();
    }
})();

let newarr = function(n){
    let arr = [];
    for(let i = 0; i < n; i++){
        arr.push(0);
    }
    return arr;
};

const Events = function(){
    const eventTable = {};
    this.on = function(type, callback){
        if(!(type in eventTable)){
            eventTable[type] = [];
        }
        eventTable[type].push(callback);
    };
    this.emit = function(type){
        const elist = eventTable[type] || [];
        for(let i = 0; i < elist.length; i++){
            elist[i].apply(this,[...arguments].slice(1));
        }
    };
};

class Selector extends ELEM{
    selected = false;
    value = 0;
    options = [];
    constructor(...options){
        super("span","class:selector;");
        let that = this;
        let bus = new Events;
        this.on = bus.on.bind(bus);
        this.emit = bus.emit.bind(bus);
        
        for(let i = 0; i < options.length; i++){
            let ostr = options[i];
            let e = this.add("span",0,ostr,ostr === options[0] ? "":"border-left:solid #888 1px;");
            e.i = i;
            that.options[i] = e;
            e.on("click",function(){
                that.selectIndex(this.i);
            }.bind(e));
        }
    }
    selectIndex(i,silent){
        let e = this.options[i];
        if(this.selected !== false && this.value === i)return;
        if(this.selected){
            this.selected.e.classList.remove("selected");
        }
        this.selected = e;
        this.selected.e.classList.add("selected");
        this.value = i;
        if(!silent)this.emit("input",this.value);
    }
};

class UISection extends ELEM{
    constructor(){
        super("section",0,0,"position:relative;opacity:0.5;");
        this.overlay = this.add("div",0,0,`
            position:absolute;
            width:100%;
            height:100%;
            background-color:#0000;
            visibility:visible;
        `);
    }
    hide(){
        this.overlay.style("visibility:visible;");
        this.style("opacity:0.5;");
    }
    show(){
        this.overlay.style("visibility:hidden;");
        this.style("opacity:1;");
    }
};

class DialogueBanner extends ELEM{
    constructor(){
        super("div",0,0,"width:100%;padding:1em;border-radius:0.5em;visibility:hidden;box-sizing:border-box;");
    }
    warn(msg){
        this.style(`
            visibility:visible;
            background-color:rgb(255 177 177 / 71%);
        `);
        this.setInner(msg);
    }
    success(msg){
        this.style(`
            visibility:visible;
            background-color:rgb(177 255 177 / 71%);
        `);
        this.setInner(msg);
    }
    hide(){
        this.style(`visibility:hidden;`);
    }
};

class TextArea extends ELEM{
    constructor(readonly){
        super("textarea",readonly?"readonly:true;":0,0,`
            width:100%;
            height:300px;
            box-sizing:border-box;
            padding: 0.5em;
            border-radius: 0.5em;
        `);
    }
};


locale = 0;
//actual contents with the locale

class SenderGUI extends ELEM{
    constructor(){
        super("div",0,0,"display:none;");
        //get public key from the receiver
        let s1 = this.add(new UISection);
        s1.show();
        s1.add("h3",0,[
            "2. Wait for the other person to send you their public key, and "+
            "paste it below",
            "2. 下に相手から貰った公開鍵を貼ってください"
        ][locale]);
        s1.input = s1.add(new TextArea);
        s1.dialogue = s1.add(new DialogueBanner);
        let pubkey;
        s1.input.on("input",async ()=>{
            let val = s1.input.e.value;
            try{
                pubkey = await import_pubkey(val);
            }catch(err){
                s1.dialogue.warn([
                    "The public key is malformed",
                    "公開鍵のフォーマットが正しくありません。"
                ][locale]);
                s2.hide();
                s3.hide();
                pubkey = null;
                return;
            }
            s1.dialogue.success([
                "Successfully recognized the public key",
                "公開鍵を認識しました"
            ][locale]);
            s2.show();
        });
        //enter the message, and click encrypt
        let s2 = this.add(new UISection);
        s2.add("h3",0,[
            "3. Please enter the message to be encrypted below",
            "3. 暗号化するメッセージを入力してください"
        ][locale]);
        s2.input = s2.add(new TextArea);
        s2.btn = s2.add("div","class:btn;",[
            "Encrypt",
            "暗号化する"
        ][locale]);
        s2.dialogue = s2.add(new DialogueBanner);
        s2.btn.on("click",async ()=>{
            if(!pubkey){
                s2.dialogue.warn([
                    "Please enter the public key first",
                    "公開鍵を入力してください"
                ][locale]);
                return;
            }
            s2.dialogue.success([
                "Encrypting...",
                "暗号化処理中..."
            ][locale]);
            let val = s2.input.e.value;
            s3.output.e.value = await encrypt(val,pubkey);
            s3.show();
            s2.dialogue.success([
                "Encryption successfully completed",
                "暗号化処理が完了しました"
            ][locale]);
        });
        //send the message to the receiver
        let s3 = this.add(new UISection);
        s3.add("h3",0,[
            "4. Please copy the encrypted message below and send it to the receiver. This is the last step for the sender.",
            "4. 暗号化されたメッセージをコピーして相手に送ってください。これで送信側全ステップ完了です。",
        ][locale]);
        s3.output = s3.add(new TextArea(true));
        s3.btn = s3.add("div","class:btn;",[
            "Copy text to the clipboard",
            "クリップボードにコピー"
        ][locale]);
        s3.dialogue = s3.add(new DialogueBanner);
        s3.btn.on("click",()=>{
            navigator.clipboard.writeText(s3.output.e.value);
            s3.dialogue.success([
                "Text copied to the clipboard",
                "テキストをコピーしました。"
            ][locale]);
        });
    }
}

class ReceiverGUI extends ELEM{
    constructor(){
        super("div",0,0,"display:none;");
        let s1 = this.add(new UISection);
        s1.show();
        s1.add("h3",0,[
            "2. Please copy the public key below and send it to the other person (The keys will be randomly generated every time the page re-freshes)",
            "2. 下に表示される公開鍵をコピーして相手に送って下さい(毎回ランダムに生成されます)"
        ][locale]);
        s1.output = s1.add(new TextArea(true));
        let keyPair;
        const generate = async function(){
            s2.hide();
            s1.dialogue.success([
                "Generating a key pair...",
                "鍵ペアを生成中..."
            ][locale]);
            keyPair = await generateKeyPair();
            s1.output.e.value = await export_pubkey(keyPair.publicKey);
            s1.dialogue.success([
                "Successfully generated a key pair",
                "鍵ペア生成完了"
            ][locale]);
            s2.show();
        }
        s1.cpybtn = s1.add("div","class:btn",[
            "Copy text to the clipboard",
            "クリップボードにコピー"
        ][locale]);
        s1.cpybtn.on("click",()=>{
            navigator.clipboard.writeText(s1.output.e.value);
            s1.dialogue.success([
                "Text copied to the clipboard",
                "テキストをコピーしました。"
            ][locale]);
        });
        s1.genbtn = s1.add("div","class:btn",[
            "Generate again↻",
            "再生成↻"
        ][locale]);
        s1.genbtn.on("click",generate);
        s1.dialogue = s1.add(new DialogueBanner);
        let s2 = this.add(new UISection);
        s2.add("h3",0,[
            "3. Please paste the encrypted message below",
            "3. 送信者から届いた暗号メッセージを貼って下さい"
        ][locale]);
        s2.input = s2.add(new TextArea);
        s2.input.on("input",async ()=>{
            if(!keyPair.privateKey){
                s2.dialogue.warn([
                    "Failed to read the private key. Please try again from the step 1 by re-generating keys.",
                    "秘密鍵の読み取りに失敗しました。ステップ1で鍵を再生成してからやり直してください。"
                ][locale]);
            }
            let val = s2.input.e.value;
            let res;
            try{
                res = await decrypt(val,keyPair.privateKey);
            }catch(err){
                s2.dialogue.warn([
                    "Malformed ciphertext or wrong public key used for encryption.",
                    "暗号のフォーマットが正しくないか暗号化に使われた公開鍵が違います。"
                ][locale]);
                return;
            }
            s2.dialogue.success([
                "Successfully decrypted the contents",
                "復号に成功しました。"
            ][locale]);
            s3.output.e.value = res;
            s3.show();
        });
        s2.dialogue = s2.add(new DialogueBanner);
        let s3 = this.add(new UISection);
        s3.add("h3",0,[
            "4. Decrypted contents will be displayed below",
            "4. 暗号の内容が表示されます"
        ][locale]);
        s3.output = s3.add(new TextArea(true));
        generate();
    }
}

let localeCodeMap = {
    EN: 0,
    JP: 1
};
let localeCodeMapReverse = ["EN","JP"];

(async ()=>{
    locale = localeCodeMap[(SearchBar.query.lang || "EN").trim().toUpperCase()];
    let header = body.add("header");
    let nav = header.add("nav");
    nav.add("div",0,0,"flex:1;");
    nav.add("span",0,"🌐","margin-right:0.3em;");
    let langsel = nav.add(new Selector("English","日本語"));
    langsel.selectIndex(locale,true);
    langsel.on("input",(locale)=>{
        let code = localeCodeMapReverse[locale];
        SearchBar.query.lang = code;
        SearchBar.reload();
    });
    let h1 = header.add("h1");
    if(locale === 0){
        h1.add("span",0,"Public Key Message Encrypton Tool 🔐","display:inline-block");
    }else if (locale === 1){
        h1.add("span",0,"メッセージ","display:inline-block");
        h1.add("span",0,"暗号化サービス🔐","display:inline-block");
    }
    header.add("p",0,[
        "Encryption simplified.<br>Copy and paste your keys to encrypt your messages on YouTube, Discord, and more.",
        "<span>手順を踏んでコピペするだけ。</span><span>YouTubeコメント欄、</span><span>Discordなど、</span><span>どのサービスでも使えます。</span>"
    ][locale]);
    let warn = header.add("div",0,0,"max-width:500px;margin:0 auto;");
    warn.add("h2",0,["⚠️Warning⚠️","⚠️注意事項⚠️"][locale]);
    warn.add("ul").add("li",0,[
        "Keys will be deleted every time the page refreshes for a security reason. Please keep the tab open throughout all the four steps.",
        "セキュリティーのためリロード時に古い鍵が消去されるので、タブを開けたままにしてください。"
    ][locale],"font-size:1rem;text-align:left;");
    /*ul.add("li",0,[
        "This site can be used on a smartphone, but it is more optimized for a use on PC.",
        "スマホでも使えますがPCをお勧めします。"
    ][locale],"font-size:1rem;text-align:left;");*/
    //this.add("h2",0,"↓スクロールする↓");
    let content = body.add("article","class:content");
    //content.add("h2",0,"メッセージを[送りたい|受け取りたい]");
    let s1 = content.add("section");
    let h3 = s1.add("h3",0,[
        "1. Please select between sending and receiving",
        "1. 送信側/受信側を選択"
    ][locale]);
    let h2 = s1.add("h4",0,["I'd like to ","メッセージを"][locale]);
    let select = h2.add(new Selector(["send","送りたい"][locale],["receive","受け取りたい"][locale]));
    let sgui = content.add(new SenderGUI);
    let rgui = content.add(new ReceiverGUI);
    let guis = [sgui,rgui];
    let state = -1;
    select.on("input",(val)=>{
        if(state === val)return;
        state = val;
        guis.map(ui=>ui.style("display:none;"));
        guis[val].style("display:block;");
    });
    body.add("footer",0,"Ⓒ2022 martian17.com All rights reserved");
})();
