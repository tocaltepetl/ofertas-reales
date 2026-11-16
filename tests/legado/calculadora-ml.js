// Lógica de cálculo de la calculadora v0 (artifact 8RDKtGqwc9QPhLdHs4GrLF), copiada sin cambios
// de comportamiento. Sirve como oráculo en las pruebas de paridad del motor. No editar salvo para
// reflejar la calculadora original.

const fmt = n => '$' + Math.round(n).toLocaleString('es-MX');
const pct = n => (n*100).toFixed(0)+'%';
function couponMonths(allowed, msi){
  const ok = allowed.filter(m => m===0 || m<=msi);
  return ok.length ? Math.max(...ok) : null;
}
export function finValue(paid, m, annual){
  if(!m || m<2 || annual<=0) return 0;
  const r = annual/100/12;
  const pv = (paid/m) * (1-Math.pow(1+r,-m))/r;
  return paid - pv;
}
function scotiaCB(amount, cap){
  let v = amount>=40000?Math.min(amount*.20,8000):amount>=25000?Math.min(amount*.15,5000):amount>=12000?Math.min(amount*.10,2500):0;
  return Math.min(v,cap);
}

export const OPTS = [
  {ent:'Mercado Pago', own:'mp_tdc', label:'Cupón TCMPBF', calc:(P,c)=>{
    if(P<4000) return {na:'Compra mínima $4,000'};
    const m = couponMonths([0,3,6], c.msi.mp); if(m===null) return {na:'Sin plazo válido'};
    const s = Math.min(P*.15,650);
    return {s, m, how:`15% (tope $650), pagando a ${m||1} ${m?'MSI':'exhibición'}`};
  }},
  {ent:'Mercado Pago', own:'mc', label:'Cupón CREDITOBF', calc:(P,c)=>{
    if(P<2000) return {na:'Compra mínima $2,000'};
    return {s:Math.min(P*.15,600), m:0, how:'15% (tope $600) pagando con Mercado Crédito'};
  }},
  {ent:'Mercado Pago', own:'mc', label:'Cupón CREDITO40 (primera vez)', calc:(P,c)=>{
    if(!c.x.mcFirst) return {na:'Solo si nunca has usado Mercado Crédito'};
    if(P<300) return {na:'Compra mínima $300'};
    return {s:Math.min(P*.40,500), m:0, how:'40% (tope $500) en tu primera compra con Mercado Crédito'};
  }},
  {ent:'Mercado Pago', own:'wallet', label:'20% con saldo en cuenta', calc:(P,c)=>{
    if(!c.x.walletNew) return {na:'Solo usuarios nuevos de la app Mercado Pago'};
    if(P<100) return {na:'Compra mínima $100'};
    return {s:Math.min(P*.20,300), m:0, how:'20% automático (tope $300) pagando con saldo Mercado Pago'};
  }},
  {ent:'Banamex', own:'banamex', label:'Cupón BNMXBF', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima $3,000'};
    const m = couponMonths([3,6,9], c.msi.banamex); if(m===null) return {na:'Requiere 3, 6 o 9 MSI'};
    return {s:Math.min(P*.10,750), m, how:`10% (tope $750) a ${m} MSI`};
  }},
  {ent:'Banamex', own:'banamex', label:'Bonificación del banco', calc:(P,c)=>{
    if(c.msi.banamex<12) return {na:'Requiere 12 MSI o más'};
    if(P<10000) return {na:'Compra mínima acumulada $10,000'};
    const p = [.10,.15,.20,.30][c.x.bnxProd||0];
    return {s:Math.min(P*p,10000), m:c.msi.banamex, how:`${pct(p)} de bonificación`};
  }},
  {ent:'Santander', own:'santander', label:'Cupón SANTBF', calc:(P,c)=>{
    if(P<3500) return {na:'Compra mínima $3,500'};
    const m = couponMonths([0,3,6], c.msi.santander);
    return {s:Math.min(P*.15,1000), m, how:`15% (tope $1,000) a ${m||1} ${m?'MSI':'exhibición'}`};
  }},
  {ent:'Santander', own:'santander', label:'Cupón SANTBF + cashback', calc:(P,c)=>{
    if(P<3500) return {na:'Compra mínima del cupón $3,500'};
    if(c.msi.santander<6) return {na:'El cashback requiere 6 MSI o más'};
    const cu = Math.min(P*.15,1000), paid = P-cu;
    if(paid<10000) return {na:'El cashback requiere $10,000 por comercio y día (después del cupón)'};
    const p = c.day==17 ? (c.x.santNom?.35:.30) : .10;
    const cb = Math.min(paid*p,7000);
    return {s:cu+cb, m:6, how:`Cupón ${fmt(cu)} a 6 MSI + ${pct(p)} cashback (${fmt(cb)})`};
  }},
  {ent:'Santander', own:'santander', label:'Solo cashback (más meses)', calc:(P,c)=>{
    if(c.msi.santander<6) return {na:'Requiere 6 MSI o más'};
    if(P<10000) return {na:'Compra mínima $10,000 por comercio y día'};
    const p = c.day==17 ? (c.x.santNom?.35:.30) : .10;
    return {s:Math.min(P*p,7000), m:c.msi.santander, how:`${pct(p)} cashback a ${c.msi.santander} MSI, sin cupón`};
  }},
  {ent:'BBVA', own:'bbva', label:'Cupón BBVABF', calc:(P,c)=>{
    if(P<5000) return {na:'Compra mínima $5,000'};
    const m = couponMonths([3,6,9], c.msi.bbva); if(m===null) return {na:'Requiere 3, 6 o 9 MSI'};
    return {s:Math.min(P*.10,550), m, how:`10% (tope $550) a ${m} MSI`};
  }},
  {ent:'BBVA', own:'bbva', label:'Bonificación del banco', calc:(P,c)=>{
    if(c.msi.bbva<12) return {na:'Requiere 12, 15 o 18 MSI'};
    if(P<5000) return {na:'Compra mínima $5,000 en una compra'};
    const p = (c.day==13||c.day==17) ? .15 : .10;
    const m = Math.min(18, c.msi.bbva);
    return {s:Math.min(P*p,2500), m, how:`${pct(p)} de bonificación a ${m} MSI`};
  }},
  {ent:'HSBC', own:'hsbc', label:'Cupón HSBCBF', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima $3,000'};
    const m = couponMonths([0,3,6], c.msi.hsbc);
    return {s:Math.min(P*.15,1000), m, how:`15% (tope $1,000) a ${m||1} ${m?'MSI':'exhibición'}`};
  }},
  {ent:'HSBC', own:'hsbc', label:'Cupón HSBCBF + devolución', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima del cupón $3,000'};
    if(c.msi.hsbc<6) return {na:'La devolución requiere 6 meses o más'};
    const cu = Math.min(P*.15,1000), paid=P-cu;
    if(paid + (+c.x.hsbcExtra||0) < 15000) return {na:'La devolución requiere $15,000 acumulados'};
    const p = (+c.x.hsbcSeg)/100 + (c.x.hsbcTr?.05:0);
    const dv = Math.min(paid*p,7000);
    return {s:cu+dv, m:6, how:`Cupón ${fmt(cu)} a 6 MSI + ${pct(p)} de devolución (${fmt(dv)})`};
  }},
  {ent:'Banorte', own:'banorte_tdc', label:'Cupón BNRTBF + 10% bonificación', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima $3,000'};
    const cu=Math.min(P*.10,1000), paid=P-cu;
    const bo = paid>3000 ? Math.min(paid*.10,5000) : 0;
    return {s:cu+bo, m:0, how:`Cupón ${fmt(cu)} + 10% bonificación (${fmt(bo)}), de contado`};
  }},
  {ent:'Banorte', own:'banorte_tdd', label:'Cupón BNRTBF (débito)', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima $3,000'};
    return {s:Math.min(P*.10,1000), m:0, how:'10% (tope $1,000) de contado con débito'};
  }},
  {ent:'American Express', own:'amex', label:'Cupón AMEXBF', calc:(P,c)=>{
    if(P<5000) return {na:'Compra mínima $5,000'};
    const m = couponMonths([0,3], c.msi.amex);
    return {s:Math.min(P*.10,525), m, how:`10% (tope $525) a ${m||1} ${m?'MSI':'exhibición'}`};
  }},
  {ent:'American Express', own:'amex', label:'Bonificación $1,500', calc:(P,c)=>{
    if(c.msi.amex<3) return {na:'Requiere pagar a MSI con Amex'};
    if(P<10000) return {na:'Requiere $10,000 acumulados en marcas participantes'};
    return {s:1500, m:c.msi.amex, how:`$1,500 en estado de cuenta, a ${c.msi.amex} MSI`};
  }},
  {ent:'American Express', own:'amex', label:'Cupón AMEXBF + $1,500', calc:(P,c)=>{
    if(P<5000) return {na:'Compra mínima del cupón $5,000'};
    if(c.msi.amex<3) return {na:'Requiere 3 MSI'};
    const cu=Math.min(P*.10,525);
    if(P-cu<10000) return {na:'Tras el cupón no llegas a $10,000 para la bonificación'};
    return {s:cu+1500, m:3, how:`Cupón ${fmt(cu)} a 3 MSI + $1,500`};
  }},
  {ent:'OXXO', own:'oxxo', label:'Cupón OXXOBF', calc:(P,c)=>{
    if(P<1500) return {na:'Compra mínima $1,500'};
    return {s:Math.min(P*.10,750), m:0, how:'10% (tope $750) pagando en efectivo en OXXO'};
  }},
  {ent:'Scotiabank', own:'scotia_tdc', label:'Cupón SCBABF', calc:(P,c)=>{
    if(P<3500) return {na:'Compra mínima $3,500'};
    return {s:Math.min(P*.15,750), m:0, how:'15% (tope $750) de contado'};
  }},
  {ent:'Scotiabank', own:'scotia_tdc', label:'Cupón SCBABF + cashback', calc:(P,c)=>{
    if(!c.x.scotiaInv) return {na:'El cashback requiere invitación e inscripción'};
    if(P<3500) return {na:'Compra mínima del cupón $3,500'};
    const cu=Math.min(P*.15,750), paid=P-cu, cb=scotiaCB(paid,9000);
    if(!cb) return {na:'El cashback requiere $12,000 acumulados (después del cupón)'};
    return {s:cu+cb, m:0, how:`Cupón ${fmt(cu)} + cashback por escala (${fmt(cb)}), de contado`};
  }},
  {ent:'Scotiabank', own:'scotia_tdc', label:'Solo cashback (a meses)', calc:(P,c)=>{
    if(!c.x.scotiaInv) return {na:'Requiere invitación e inscripción'};
    const cb=scotiaCB(P,9000); if(!cb) return {na:'Requiere $12,000 acumulados'};
    return {s:cb, m:c.msi.scotia, how:`Cashback por escala (${fmt(cb)}) a ${c.msi.scotia} MSI`};
  }},
  {ent:'Scotiabank', own:'scotia_tdd', label:'Cashback débito', calc:(P,c)=>{
    if(!c.x.scotiaInv) return {na:'Requiere invitación e inscripción'};
    const cb=scotiaCB(P,2500); if(!cb) return {na:'Requiere $12,000 acumulados'};
    return {s:cb, m:0, how:`Cashback por escala con débito (tope $2,500)`};
  }},
  {ent:'Afirme', own:'afirme', label:'Cupón AFRMBF', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima $3,000'};
    const m = couponMonths([0,3,6,9,12], c.msi.afirme);
    return {s:Math.min(P*.20,1000), m, how:`20% (tope $1,000) a ${m||1} ${m?'MSI':'exhibición'}`};
  }},
  {ent:'Afirme', own:'afirme', label:'Cupón AFRMBF + bonificación', calc:(P,c)=>{
    if(P<3000) return {na:'Compra mínima del cupón $3,000'};
    if(c.msi.afirme<6) return {na:'La bonificación requiere 6 MSI o más'};
    const cu=Math.min(P*.20,1000), paid=P-cu;
    if(paid<10000) return {na:'La bonificación requiere $10,000 acumulados (después del cupón)'};
    const m=Math.min(12,c.msi.afirme), bo=Math.min(paid*.10,6000);
    return {s:cu+bo, m, how:`Cupón ${fmt(cu)} + 10% bonificación (${fmt(bo)}) a ${m} MSI`};
  }},
  {ent:'INVEX', own:'invex', label:'Cupón INVEBF', calc:(P,c)=>{
    if(P<3500) return {na:'Compra mínima $3,500'};
    const m = couponMonths([3,6,9,12], c.msi.invex); if(m===null) return {na:'Requiere 3–12 MSI'};
    return {s:Math.min(P*.10,500), m, how:`10% (tope $500) a ${m} MSI`};
  }},
  {ent:'INVEX', own:'invex', label:'Cupón INVEBF + bonificación', calc:(P,c)=>{
    if(!c.x.invexMeta) return {na:'Requiere alcanzar la meta individual notificada por INVEX'};
    if(c.msi.invex<9) return {na:'La bonificación requiere 9 MSI o más'};
    const cu = P>=3500?Math.min(P*.10,500):0, paid=P-cu, m=Math.min(12,c.msi.invex);
    const bo=Math.min(paid*.10,5000);
    return {s:cu+bo, m, how:`Cupón ${fmt(cu)} + 10% bonificación (${fmt(bo)}) a ${m} MSI`};
  }},
  {ent:'Openbank', own:'openbank', label:'Cupón OPBABF + cashback', calc:(P,c)=>{
    if(P<2000) return {na:'Compra mínima $2,000'};
    const cu = P>=2500?Math.min(P*.10,500):0, paid=P-cu, cb=Math.min(paid*.15,500);
    return {s:cu+cb, m:9, how:`Cupón ${fmt(cu)} de contado + 15% cashback (${fmt(cb)}) al diferir desde la app (hasta 9 MSI)`};
  }},
  {ent:'Mifel', own:'mifel', label:'Cupón MIFEBF', calc:(P,c)=>{
    if(P<3500) return {na:'Compra mínima $3,500'};
    return {s:Math.min(P*.15,900), m:0, how:'15% (tope $900) de contado'};
  }},
  {ent:'Mifel', own:'mifel', label:'Bonificación del banco', calc:(P,c)=>{
    if(c.msi.mifel<12) return {na:'Requiere 12 MSI o más'};
    const s = P>=50000?6000:P>=25000?2500:P>=10000?1000:0;
    if(!s) return {na:'Requiere $10,000 acumulados'};
    return {s, m:c.msi.mifel, how:`${fmt(s)} por escala, a ${c.msi.mifel} MSI`};
  }},
  {ent:'Falabella', own:'falabella', label:'15% reembolso', calc:(P,c)=>{
    if(c.msi.falabella<3) return {na:'Requiere pagar a MSI'};
    if(P<2000) return {na:'Compra mínima $2,000'};
    return {s:Math.min(P*.15,1000), m:c.msi.falabella, how:`15% (tope $1,000) a ${c.msi.falabella} MSI`};
  }},
  {ent:'BanCoppel', own:'bancoppel_tdc', label:'Bonificación crédito', calc:(P,c)=>{
    const p = P>8500?.20:P>4500?.15:P>=3000?.10:0; if(!p) return {na:'Requiere $3,000 acumulados'};
    return {s:Math.min(P*p,2200), m:c.msi.bancoppel, how:`${pct(p)} (tope $2,200)`};
  }},
  {ent:'BanCoppel', own:'bancoppel_tdd', label:'Bonificación débito / nómina', calc:(P,c)=>{
    const p = P>6000?.20:P>3000?.15:P>=2000?.10:0; if(!p) return {na:'Requiere $2,000 acumulados'};
    return {s:Math.min(P*p,1500), m:0, how:`${pct(p)} (tope $1,500) de contado`};
  }},
  {ent:'Nu', own:'nu', label:'Pase Morado Nuviembre', calc:(P,c)=>{
    if(c.msi.nu<6) return {na:'Requiere 6 MSI o más'};
    const passes = Math.floor(P/3000);
    return {s:0, m:c.msi.nu, how:`${passes} Pase(s) Morado(s)`};
  }},
  {ent:'DiDi Card', own:'didi', label:'Cashback DiDi', calc:(P,c)=>{
    if(P<500) return {na:'Compra mínima $500'};
    const p = P>=5000?.20:.10;
    return {s:Math.min(P*p,2000), m:c.msi.didi, how:`${pct(p)} cashback (tope $2,000)`};
  }},
  {ent:'Klar', own:'klar', label:'10% cashback', calc:(P,c)=>{
    if(c.msi.klar<6) return {na:'Requiere 6 MSI o más'};
    if(P<4000) return {na:'Compra mínima $4,000 por cargo'};
    return {s:Math.min(P*.10,800), m:c.msi.klar, how:`10% (tope $800) a ${c.msi.klar} MSI`};
  }},
];

function couponPart(o,r){
  if(o.label.startsWith('Cupón')){
    const m = r.how.match(/Cupón \$([\d,]+)/); if(m) return +m[1].replace(/,/g,'');
    return r.s;
  }
  if(o.label.startsWith('20%')) return r.s;
  return 0;
}

/** Igual que compute() de la calculadora: devuelve las opciones válidas y las que no aplican. */
export function calcular(P, ctx, own, rate){
  const ok = [], na = [];
  for (const o of OPTS){
    if(!own[o.own]) continue;
    const r = o.calc(P, ctx);
    if(r.na){ na.push({o, why:r.na}); continue; }
    const fin = finValue(P - couponPart(o,r), r.m, rate);
    ok.push({o, ...r, fin, total:r.s+fin});
  }
  return {ok, na};
}
