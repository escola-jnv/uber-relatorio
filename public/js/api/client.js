// Camada de comunicação com a API backend
export async function api(path, opt = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-token': localStorage.tk || '',
    ...(opt.headers || {})
  };

  const res = await fetch('/api/' + path, { ...opt, headers });

  if (res.status === 401) {
    const token = prompt('Código de acesso da aplicação:');
    if (token) {
      localStorage.tk = token.trim();
      return api(path, opt);
    }
    throw new Error('Acesso não autorizado');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Erro na requisição (${res.status})`);
  }

  return json;
}

export function fetchEntries(days = 365) {
  return api(`entries?days=${days}`);
}

export function fetchConfig() {
  return api('config');
}

export function saveConfigApi(config) {
  return api('config', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export function createEntryApi(body) {
  return api('entries', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function updateEntryApi(id, updates) {
  return api(`entries?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export function deleteEntryApi(id) {
  return api(`entries?id=${id}`, {
    method: 'DELETE'
  });
}
