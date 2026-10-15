/* Pix assistido: o envio de um arquivo nunca confirma recebimento bancário. */
(function(root){
 'use strict';
 const TIPOS=['application/pdf','image/jpeg','image/png','image/webp'];
 async function validarArquivo(file){
  if(!file||file.size<=0||file.size>5*1024*1024)throw new Error('Escolha um PDF ou imagem de até 5 MB.');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const texto=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
  const real=texto(0,5)==='%PDF-'?'application/pdf':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&texto(1,4)==='PNG'?'image/png':texto(0,4)==='RIFF'&&texto(8,12)==='WEBP'?'image/webp':null;
  if(!TIPOS.includes(real)||file.type&&file.type!==real)throw new Error('Formato inválido. Envie PDF, JPG, PNG ou WebP.');
  return real;
 }
 async function criar(sb,ck,carrinho,telefone,endereco){
  ck.pixRequisicao=ck.pixRequisicao||crypto.randomUUID();
  const {data,error}=await sb.rpc('pix_criar_pedido',{dados:{nome:ck.nome,telefone,tipo_entrega:ck.tipo,endereco,observacao:ck.obs,requisicao:ck.pixRequisicao,origem:'cardapio',itens:carrinho.map(i=>({produto_id:i.pid,quantidade:i.qtd,observacao:i.obs||''}))}});
  if(error)throw error;return data;
 }
 async function anexar(sb,pedido,file){
  if(!pedido.pixToken)throw new Error('Reabra o link de pagamento deste pedido para anexar o comprovante.');
  const mime=await validarArquivo(file);const ext=({'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[mime];
  const arquivo=pedido.id+'/'+pedido.pixToken+'/'+crypto.randomUUID()+'.'+ext;
  const upload=await sb.storage.from('comprovantes-pix').upload(arquivo,file,{contentType:mime,upsert:false});if(upload.error)throw upload.error;
  const r=await sb.rpc('pix_anexar',{p_pedido:pedido.id,p_token:pedido.pixToken,p_arquivo:arquivo,p_nome:file.name,p_mimetype:mime,p_origem:'cardapio'});
  if(r.error)throw r.error;return r.data;
 }
 async function consultar(sb,pedido){const r=await sb.rpc('pix_consultar',{p_pedido:pedido.id,p_token:pedido.pixToken});if(r.error)throw r.error;return r.data;}
 root.PixCheckout={validarArquivo,criar,anexar,consultar};
})(typeof window!=='undefined'?window:globalThis);
