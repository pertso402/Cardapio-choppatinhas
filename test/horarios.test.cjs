'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pasta = path.join(__dirname, '../cardapio-v3');
function fixture(data = '2026-10-15T21:00:00Z') {
  const chamadas = [], mensagens = [];
  let info = [{ chave: 'loja_aberta', valor: 'true' }]; let falha = null;
  class DataFixa extends Date { constructor(...args) { super(...(args.length ? args : [data])); } static now() { return new Date(data).getTime(); } }
  const elementos = new Map();
  const elemento = id => {
    if (!elementos.has(id)) elementos.set(id, { innerHTML: '', textContent: '', hidden: false, classList: { toggle() {} }, querySelector: () => null });
    return elementos.get(id);
  };
  const ctx = {
    Date: DataFixa, console, localStorage: { getItem: () => null }, setInterval() {}, setTimeout() {}, addEventListener() {},
    document: { addEventListener() {}, querySelector: elemento }, matchMedia: () => ({ matches: false }),
    window: { supabase: { createClient: () => ({ from: tabela => {
      chamadas.push(tabela);
      if (tabela !== 'info_restaurante') throw new Error('Tentou escrever pedido sem checar o horário');
      return { select: async () => ({ data: info, error: falha }) };
    } }) } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(pasta,'config.js'),'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(pasta,'horarios.js'),'utf8'), ctx);
  ctx.window.HorariosRestaurante = ctx.HorariosRestaurante;
  const context = { ...ctx, avisos: mensagens };
  vm.runInNewContext(fs.readFileSync(path.join(pasta,'app.js'),'utf8') + '\n;globalThis.api={S,lojaAberta,horarioTxt,ckBotaoHTML,finalizar,atualizarInfo,admLojaHTML}; toast=t=>globalThis.avisos.push(t); renderComanda=()=>{}; validarCheckout=()=>true; atualizarFuncionamento=()=>{};', context);
  context.api.S.infoCarregada = true;
  context.api.S.ck = { tipo: 'retirada', enviando: false };
  return { ...context.api, chamadas, mensagens, setInfo: valor => { info = valor; }, setFalha: valor => { falha = valor; } };
}
test('cardápio segue o expediente de Brasília e mantém pausa manual', () => {
  const f = fixture('2026-10-15T20:29:59Z'); assert.equal(f.lojaAberta(),false);
  const aberto = fixture(); assert.equal(aberto.lojaAberta(),true);
  aberto.S.info.loja_aberta = 'false'; assert.equal(aberto.lojaAberta(),false);
  assert.equal(fixture('2026-10-18T15:00:00Z').lojaAberta(),false);
  assert.equal(fixture('2026-10-17T14:00:00Z').lojaAberta(),true);
  assert.match(f.horarioTxt(),/Domingo: fechado/);
});
test('fora do expediente desabilita envio e não acessa pedidos nem clientes', async () => {
  const f = fixture('2026-10-15T20:00:00Z');
  assert.match(f.ckBotaoHTML(),/disabled/); await f.finalizar();
  assert.equal(f.chamadas.length,0); assert.match(f.mensagens[0],/fora do horário/);
});
test('reconsulta horário ao enviar e bloqueia se a configuração mudou', async () => {
  const f = fixture(); f.setInfo([{ chave: 'loja_aberta', valor: 'false' }]);
  await f.finalizar(); assert.deepEqual(f.chamadas,['info_restaurante']);
  assert.equal(f.lojaAberta(),false); assert.match(f.mensagens[0],/indisponível/);
});
test('falha de consulta mantém o cardápio fechado e recuperação reabre', async () => {
  const f = fixture(); f.setFalha(new Error('Sem conexão')); await f.atualizarInfo();
  assert.equal(f.lojaAberta(),false); f.setFalha(null); await f.atualizarInfo(); assert.equal(f.lojaAberta(),true);
});
test('configuração semanal do banco atualiza o cardápio sem editar código', async () => {
  const f = fixture();
  f.setInfo([{ chave:'horarios_funcionamento',valor:JSON.stringify({0:[],1:[],2:[],3:[],4:[],5:[],6:[]}) }]);
  await f.atualizarInfo(); assert.equal(f.lojaAberta(),false);
  assert.match(f.admLojaHTML(),/data-hora-dia="0"/);
});
