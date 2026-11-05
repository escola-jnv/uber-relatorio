// Interpreta mensagens curtas (WhatsApp ou campo rápido da app).
// Exemplos:  "25,50 joão 14:30"  "+18 maria 6km"  "odo 45230"  "gas 150"
//            "inicio 45100"  "fim 45230"  "almoço 25"
//            "pausa" / "voltei" / "pausa 12:00" / "pausa 20min" (retroativa)
const OFF = -3; // America/Sao_Paulo (sem horário de verão)

const DESP = {
  gas: 'combustivel', gasolina: 'combustivel', etanol: 'combustivel', alcool: 'combustivel',
  comb: 'combustivel', combustivel: 'combustivel', abast: 'combustivel', abasteci: 'combustivel', gnv: 'combustivel',
  almoco: 'alimentacao', janta: 'alimentacao', lanche: 'alimentacao', comida: 'alimentacao', cafe: 'alimentacao',
  lavagem: 'lavagem', lava: 'lavagem', pedagio: 'pedagio', estac: 'estacionamento', estacionamento: 'estacionamento',
  manut: 'manutencao', manutencao: 'manutencao', oleo: 'manutencao', pneu: 'manutencao', mecanico: 'manutencao',
  desp: 'outros', despesa: 'outros', gasto: 'outros', aluguel: 'aluguel', seguro: 'seguro'
};
const INI = /^(ini|inicio|iniciar|comecei|comeco|start|on|online|bora)\b/;
const FIM = /^(fim|parei|parar|stop|off|offline|encerrei|encerra|encerrar|fui)\b/;
const PAUSA_INI = /^(pausa|pausar|pausei|pausando|intervalo|descanso|descansar|descansando|break)\b/;
const PAUSA_FIM = /^(volta|voltei|voltando|retomei|retomar|retomada|retoma|fim\s+(?:da\s+)?pausa|fim\s+(?:do\s+)?(?:intervalo|descanso))/;
const ODO = /^(odo|odometro|hodometro|km)\b/;
const GANHO = /^(ganho|corrida|viagem|uber|gorjeta|bonus|promo)\b/;

const strip = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function toNum(s) {
  s = String(s).replace(/r\$\s*/i, '').trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s.replace(',', '.'));
}

function tsFrom(h, m, now) {
  const local = new Date(now.getTime() + OFF * 3600e3);
  const d = local.toISOString().slice(0, 10);
  let t = new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${OFF < 0 ? '-' : '+'}${String(Math.abs(OFF)).padStart(2, '0')}:00`);
  if (t.getTime() > now.getTime() + 10 * 60e3) t = new Date(t.getTime() - 864e5); // hora "futura" = ontem
  return t.toISOString();
}

export function parseLine(raw, now = new Date()) {
  let orig = String(raw || '').trim();
  if (!orig) return null;
  let l = strip(orig);
  const row = { ts: now.toISOString() };

  // horário hh:mm / hhhmm
  const hm = l.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/);
  if (hm) { row.ts = tsFrom(+hm[1], +hm[2], now); l = l.replace(hm[0], ' '); }

  // km da corrida: "6km" "6,5 km"
  const kmM = l.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  const isOdoCmd = ODO.test(l) && !/^km\b\s*$/.test(l);
  if (kmM && !isOdoCmd) { row.km = toNum(kmM[1]); l = l.replace(kmM[0], ' '); }

  const numM = l.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  const n = numM ? toNum(numM[1]) : null;
  const rest = () => l.replace(numM ? numM[0] : '', ' ');
  const words = s => s.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const first = (l.trim().match(/^[+]?\s*([a-z]+)/) || [])[1] || '';

  // pausas: "pausa" / "voltei" (agora ou no horário dado) e "pausa 20min" (retroativa: início há 20 min, já encerrada)
  if (PAUSA_FIM.test(l.trim())) return { ...row, tipo: 'pausa_fim', valor: null };
  if (PAUSA_INI.test(l.trim())) {
    const dur = l.match(/(\d{1,3})\s*min\b/);
    if (dur && +dur[1] > 0) {
      const fim = new Date(row.ts), ini = new Date(fim.getTime() - +dur[1] * 6e4);
      return [{ ...row, ts: ini.toISOString(), tipo: 'pausa_ini', valor: null },
              { ...row, ts: fim.toISOString(), tipo: 'pausa_fim', valor: null }];
    }
    return { ...row, tipo: 'pausa_ini', valor: null };
  }

  if (INI.test(l.trim())) return { ...row, tipo: 'sessao_ini', valor: n };
  if (FIM.test(l.trim())) return { ...row, tipo: 'sessao_fim', valor: n };
  if (ODO.test(l.trim()) && n != null) return { ...row, tipo: 'odometro', valor: n };

  // palavra de despesa no início ("gas 150") ou em qualquer posição ("150 abastecer", "pagar aluguel 500")
  const match = (wd, min) => Object.keys(DESP).find(k => wd === k || (k.length >= min && wd.startsWith(k)));
  const dk = match(first, 4) || words(rest()).map(wd => match(wd, 5)).find(Boolean);
  if (dk && n != null) {
    const obs = words(rest()).slice(1).join(' ');
    return { ...row, tipo: 'despesa', valor: n, categoria: DESP[dk], obs: obs || null };
  }

  if (n == null || !(n > 0)) return null;
  if (n > 2000) return { ...row, tipo: 'odometro', valor: n }; // número grande solto = odômetro
  let w = words(rest());
  let obs = null;
  if (w.length && GANHO.test(w[0])) { if (/gorjeta|bonus|promo/.test(w[0])) obs = w[0]; w = w.slice(1); }
  const nomeOrig = w.length ? orig.split(/\s+/).find(x => strip(x).replace(/[^a-z]/g, '') === w[0]) : null;
  const pas = w.length ? [nomeOrig ? nomeOrig.replace(/[^\p{L}]/gu, '') : w[0], ...w.slice(1)].join(' ') : null;
  const title = s => s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return { ...row, tipo: 'ganho', valor: n, passageiro: pas ? title(pas) : null, obs };
}

export function parseText(text, now = new Date()) {
  return String(text || '').split(/\n|;/).flatMap(s => parseLine(s, now) ?? []);
}
