const spkiToPEM = function(keydata){
    const keydataB64 = arrayBufferToBase64(keydata);
    const keydataB64Pem = formatAsPem(keydataB64);
    return keydataB64Pem;
};

const arrayBufferToString = function( buff ) {
    let binary = '';
    const bytes = new Uint8Array( buff );
    for (byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return binary;
};

const arrayBufferToBase64 = function( buff ){
    return window.btoa(arrayBufferToString(buff));
};

const base64ToArrayBuffer = function( str ){
    return (new Uint8Array(window.atob(str).split("").map(c=>c.charCodeAt(0)))).buffer;
};

//convert to utf8 array buffer
const stringToUTF8ArrayBuffer = function( str ){
    return new TextEncoder("utf-8").encode(str).buffer;
};

const UTF8ArrayBufferToString = function( buff ){
    return new TextDecoder().decode(new Uint8Array(buff));
};


const formatAsPem = function(str) {
    let finalString = '-----BEGIN PUBLIC KEY-----\n';

    while(str.length > 0) {
        finalString += str.substring(0, 64) + '\n';
        str = str.substring(64);
    }

    finalString = finalString + "-----END PUBLIC KEY-----";

    return finalString;
};

const import_pubkey = async function(pem){
    return await crypto.subtle.importKey(
        "spki",
        new Uint8Array(atob(pem.split("\n").slice(1,-1).join("")).split("").map(c=>c.charCodeAt(0))).buffer,
        {
            name: "RSA-OAEP",
            hash: {name: "SHA-256"}
        },
        true,
        ["encrypt"]
    );
};

const export_pubkey = async function(pubkey){
    let buff = await crypto.subtle.exportKey("spki", pubkey);
    return spkiToPEM(buff);
};


const encrypt = async function(str,pubkey){
    return arrayBufferToBase64(await crypto.subtle.encrypt(
        {
            name: "RSA-OAEP",
        },
        pubkey,
        stringToUTF8ArrayBuffer(str)
    ));
};

const decrypt = async function(str,privkey){
    return UTF8ArrayBufferToString(await crypto.subtle.decrypt(
        {
            name: "RSA-OAEP",
        },
        privkey,
        base64ToArrayBuffer(str)
    ));
};


const generateKeyPair = async function(){
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
};