let body = new ELEM(document.body);


let URL = new (function(){
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

let getLocale = function(){
    return URL.query.lang || "EN";
}

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
    constructor(...options){
        super("span","class:selector;");
        let that = this;
        let bus = new Events;
        this.on = bus.on.bind(bus);
        this.emit = bus.emit.bind(bus);
        
        let selected = false;
        let value = 0;
        
        for(let i = 0; i < options.length; i++){
            let ostr = options[i];
            let e = this.add("span",0,ostr,ostr === options[0] ? "":"border-left:solid #888 1px;");
            e.i = i;
            e.on("click",function(){
                if(selected !== false && value === this.i)return;
                if(selected){
                    selected.e.classList.remove("selected");
                }
                selected = this;
                selected.e.classList.add("selected");
                value = this.i;
                that.emit("input",value);
            }.bind(e));
        }
    }
}

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


//actual contents with the locale applied

class SenderGUI extends ELEM{
    constructor(){
        super("div",0,0,"display:none;");
        //get public key from the receiver
        let s1 = this.add(new UISection);
        s1.show();
        s1.add("h3",0,"2. 下に相手から貰った公開鍵を貼ってください");
        s1.input = s1.add(new TextArea);
        s1.dialogue = s1.add(new DialogueBanner);
        let pubkey;
        s1.input.on("input",async ()=>{
            let val = s1.input.e.value;
            try{
                pubkey = await import_pubkey(val);
            }catch(err){
                s1.dialogue.warn("公開鍵のフォーマットが正しくありません。");
                s2.hide();
                s3.hide();
                pubkey = null;
                return;
            }
            s1.dialogue.success("公開鍵を認識しました");
            s2.show();
        });
        //enter the message, and click encrypt
        let s2 = this.add(new UISection);
        s2.add("h3",0,"3. 暗号化するメッセージを入力してください");
        s2.input = s2.add(new TextArea);
        s2.btn = s2.add("div","class:btn;","暗号化する");
        s2.dialogue = s2.add(new DialogueBanner);
        s2.btn.on("click",async ()=>{
            if(!pubkey){
                s2.dialogue.warn("公開鍵を入力してください");
                return;
            }
            s2.dialogue.success("暗号化処理中");
            let val = s2.input.e.value;
            s3.output.e.value = await encrypt(val,pubkey);
            s3.show();
            s2.dialogue.success("暗号化処理が完了しました");
        });
        //send the message to the receiver
        let s3 = this.add(new UISection);
        s3.add("h3",0,"4. 暗号化されたメッセージをコピーして相手に送ってください。これで送信側全ステップ完了です。");
        s3.output = s3.add(new TextArea(true));
        s3.btn = s3.add("div","class:btn;","クリップボードにコピー");
        s3.dialogue = s3.add(new DialogueBanner);
        s3.btn.on("click",()=>{
            navigator.clipboard.writeText(s3.output.e.value);
            s3.dialogue.success("テキストをコピーしました。");
        });
    }
}

class ReceiverGUI extends ELEM{
    constructor(){
        super("div",0,0,"display:none;");
        let s1 = this.add(new UISection);
        s1.show();
        s1.add("h3",0,"2. 下に表示される公開鍵をコピーして相手に送って下さい(毎回ランダムに生成されます)");
        s1.output = s1.add(new TextArea(true));
        let keyPair;
        const generate = async function(){
            s2.hide();
            s1.dialogue.success("鍵ペアを生成中...");
            keyPair = await generateKeyPair();
            s1.output.e.value = await export_pubkey(keyPair.publicKey);
            s1.dialogue.success("鍵ペア生成完了");
            s2.show();
        }
        s1.cpybtn = s1.add("div","class:btn","クリップボードにコピー");
        s1.cpybtn.on("click",()=>{
            navigator.clipboard.writeText(s1.output.e.value);
            s1.dialogue.success("テキストをコピーしました。");
        });
        s1.genbtn = s1.add("div","class:btn","再生成↻");
        s1.genbtn.on("click",generate);
        s1.dialogue = s1.add(new DialogueBanner);
        let s2 = this.add(new UISection);
        s2.add("h3",0,"3. 送信者から届いた暗号メッセージを貼って下さい");
        s2.input = s2.add(new TextArea);
        s2.input.on("input",async ()=>{
            if(!keyPair.privateKey){
                s2.dialogue.warn("秘密鍵の読み取りに失敗しました。ステップ1で鍵を再生成してからやり直してください。");
            }
            let val = s2.input.e.value;
            let res;
            try{
                res = await decrypt(val,keyPair.privateKey);
            }catch(err){
                s2.dialogue.warn("暗号のフォーマットが正しくないか暗号化に使われた公開鍵が違います。");
                return;
            }
            s2.dialogue.success("復号に成功しました。");
            s3.output.e.value = res;
            s3.show();
        });
        s2.dialogue = s2.add(new DialogueBanner);
        let s3 = this.add(new UISection);
        s3.add("h3",0,"4. 暗号の内容が表示されます");
        s3.output = s3.add(new TextArea(true));
        generate();
    }
}


(async ()=>{
    let locale = URL.query.lang || "EN";
    let header = body.add("header");
    let h1 = header.add("h1");
    h1.add("span",0,"🔐メッセージ","display:inline-block");
    h1.add("span",0,"暗号化サービス","display:inline-block");
    header.add("p",0,"手順を踏んでコピペするだけ。YouTubeコメント欄、Discordなどどのサービスでも使えます。");
    let ul = header.add("ul",0,0,"max-width:500px;margin:0 auto;");
    ul.add("h2",0,"注意事項");
    ul.add("li",0,"送信側はリロードするとセキュリティーのため古い鍵が消去されるので、タブを開けたままにしてください。","font-size:1rem;text-align:left;");
    ul.add("li",0,"スマホでも使えますがPCをお勧めします。","font-size:1rem;text-align:left;");
    //this.add("h2",0,"↓スクロールする↓");
    let content = body.add("article","class:content");
    //content.add("h2",0,"メッセージを[送りたい|受け取りたい]");
    let s1 = content.add("section");
    let h3 = s1.add("h3",0,"1. 送信側/受信側を選択");
    let h2 = s1.add("h4",0,"メッセージを");
    let select = h2.add(new Selector("送りたい","受け取りたい"));
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
