'use strict';
const{test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const crypto=require('node:crypto').webcrypto;
const base=path.join(__dirname,'../cardapio-v3');
function carregarPix(){const ctx={window:{},crypto};vm.runInNewContext(fs.readFileSync(path.join(base,'pix.js'),'utf8'),ctx);return ctx.window.PixCheckout;}
test('upload aceita PDF, JPG e PNG e recusa arquivo falso ou acima de 5 MB',async()=>{
 const p=carregarPix();for(const [bytes,mime]of [[Buffer.from('%PDF-1.4 teste'),'application/pdf'],[Buffer.from([255,216,255,1]),'image/jpeg'],[Buffer.from([137,80,78,71,13,10,26,10]),'image/png']])assert.equal(await p.validarArquivo(new File([bytes],'comprovante',{type:mime})),mime);
 await assert.rejects(p.validarArquivo(new File(['falso'],'recibo.pdf',{type:'application/pdf'})),/Formato inválido/);await assert.rejects(p.validarArquivo(new File([Buffer.alloc(5242881)],'grande.pdf',{type:'application/pdf'})),/5 MB/);
});
test('upload associa arquivo ao token e ao pedido sem confirmar pagamento',async()=>{
 const p=carregarPix(),chamadas=[];const sb={storage:{from:nome=>({upload:async(...args)=>{chamadas.push({nome,args});return{};}})},rpc:async(nome,args)=>{chamadas.push({nome,args});return{data:'anexo-id'};}};
 await p.anexar(sb,{id:'pedido1',pixToken:'segredo'},new File(['%PDF-1.4 teste'],'pix.pdf',{type:'application/pdf'}));
 assert.equal(chamadas[0].nome,'comprovantes-pix');assert.match(chamadas[0].args[0],/^pedido1\/segredo\//);assert.equal(chamadas[1].nome,'pix_anexar');assert.equal(chamadas[1].args.p_token,'segredo');assert.equal(chamadas.length,2);
});
test('criação reaproveita o ID da requisição em uma retentativa',async()=>{
 const p=carregarPix(),calls=[];const sb={rpc:async(nome,args)=>{calls.push(args);return{data:{id:'pedido'}};}};const ck={nome:'Cliente',tipo:'retirada'};
 await p.criar(sb,ck,[{pid:'produto',qtd:1}], '5544999999999',null);await p.criar(sb,ck,[{pid:'produto',qtd:1}], '5544999999999',null);assert.equal(calls[0].dados.requisicao,calls[1].dados.requisicao);
});
function appFixture(){
 const ctx={crypto,console,localStorage:{getItem:()=>null},setInterval(){},setTimeout(){},addEventListener(){},document:{addEventListener(){}},matchMedia:()=>({matches:false}),location:{hash:''},window:{supabase:{createClient:()=>({})}}};
 vm.runInNewContext(fs.readFileSync(path.join(base,'config.js'),'utf8'),ctx);vm.runInNewContext(fs.readFileSync(path.join(base,'horarios.js'),'utf8'),ctx);ctx.window.HorariosRestaurante=ctx.HorariosRestaurante;
 vm.runInNewContext(fs.readFileSync(path.join(base,'app.js'),'utf8')+'\n;globalThis.api={S,cmdStatus,retomarPixDoLink};abrirStatus=async u=>{globalThis.recebido=u;};',ctx);return ctx;
}
test('tela Pix oferece PDF/imagem e WhatsApp sem anunciar preparo',()=>{
 const f=appFixture();f.api.S.info.whatsapp='44999999999';f.api.S.ult={id:'1',numero:123,total:50,status:'aguardando_pix',pixStatus:'aguardando_comprovante',pixChave:'02668346000198'};
 const html=f.api.cmdStatus();assert.match(html.corpo,/application\/pdf/);assert.match(html.corpo,/image\/jpeg/);assert.match(html.pe,/Enviar pelo WhatsApp/);assert.doesNotMatch(html.corpo,/já.*cozinha|pagamento confirmado/i);
});
test('link de retorno recupera o pedido correto e preserva retirada',async()=>{
 const f=appFixture();f.location.hash='#pix=11111111-1111-4111-8111-111111111111.22222222-2222-4222-8222-222222222222';f.window.PixCheckout={consultar:async()=>({numero_pedido:123,total:50,status:'aguardando_pix',tipo_entrega:'retirada',itens:[]})};
 await f.api.retomarPixDoLink();assert.equal(f.recebido.numero,123);assert.equal(f.recebido.tipo,'retirada');assert.equal(f.recebido.id,'11111111-1111-4111-8111-111111111111');
});
