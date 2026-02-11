const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');
const querystring = require('querystring');

const dataFile = path.join(__dirname, 'data', 'tasks.json');
const cssFile = path.join(__dirname, 'public', 'stylesheets', 'style.css');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function readData() {
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function getNextTaskId(tasks) {
  return tasks.length ? Math.max(...tasks.map((task) => task.id)) + 1 : 1;
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function renderPage(data, selectedUser, errorFlag) {
  const usersOptions = data.users
    .map((user) => `<option value="${escapeHtml(user)}" ${selectedUser === user ? 'selected' : ''}>${escapeHtml(user)}</option>`)
    .join('');

  const filteredTasks = data.tasks.filter((task) => task.owner === selectedUser);

  const userTasksHtml = filteredTasks.length
    ? filteredTasks.map((task) => `
      <div class="list-group-item">
        <form action="/tasks/${task.id}/toggle?user=${encodeURIComponent(selectedUser)}" method="post">
          <button class="btn">${task.done ? 'Desmarcar' : 'Comprar'}</button>
        </form>
        <p class="task-title ${task.done ? 'done' : ''}">${escapeHtml(task.title)}</p>
        <form action="/tasks/${task.id}/delete?user=${encodeURIComponent(selectedUser)}" method="post">
          <button class="btn item-delete">Borrar</button>
        </form>
      </div>`).join('')
    : '<div class="list-group-item empty">No hay productos para este usuario.</div>';

  const allTasksHtml = data.tasks.length
    ? data.tasks.map((task) => `
      <div class="list-group-item">
        <p class="task-title ${task.done ? 'done' : ''}">${escapeHtml(task.title)}</p>
        <span class="badge">${escapeHtml(task.owner)}</span>
      </div>`).join('')
    : '<div class="list-group-item empty">No hay productos guardados.</div>';

  return `<!DOCTYPE html>
<html>
  <head>
    <title>Shopping TODO List</title>
    <link rel="stylesheet" href="/stylesheets/style.css" />
    <meta charset="utf-8" />
  </head>
  <body>
    <div class="container">
      <h1>Shopping TODO List (shared JSON)</h1>
      <p class="json-link">JSON público: <a href="/api/tasks" target="_blank" rel="noreferrer">/api/tasks</a></p>

      <div class="row">
        <div class="col d-col w-100">
          <form action="/tasks" method="post" class="task-form">
            <label for="owner">Usuario</label>
            <select id="owner" name="owner" class="form-control">${usersOptions}</select>

            <label for="title">Producto</label>
            <input id="title" type="text" class="form-control" name="title" minlength="3" placeholder="Ej: Arroz" required>
            <button class="btn btn-primary">Agregar</button>
          </form>
          ${errorFlag ? '<div class="alert"><p class="invalid-text">El texto debe contener al menos 3 caracteres y un usuario válido.</p></div>' : ''}
        </div>
      </div>

      <div class="row">
        <div class="col d-col">
          <h2>Lista de ${escapeHtml(selectedUser)}</h2>
          <div class="list-group">${userTasksHtml}</div>
        </div>

        <div class="col d-col">
          <h2>Vista global (todos)</h2>
          <div class="list-group">${allTasksHtml}</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function app(req, res) {
  try {
    const currentUrl = new URL(req.url, 'http://localhost');
    const pathname = currentUrl.pathname;

    if (req.method === 'GET' && pathname === '/stylesheets/style.css') {
      const css = await fs.readFile(cssFile, 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.end(css);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/tasks') {
      const data = await readData();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data, null, 2));
      return;
    }

    if (req.method === 'GET' && pathname === '/') {
      const data = await readData();
      const requestedUser = currentUrl.searchParams.get('user');
      const selectedUser = data.users.includes(requestedUser) ? requestedUser : data.users[0];
      const errorFlag = currentUrl.searchParams.get('error') === 'invalid';

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(renderPage(data, selectedUser, errorFlag));
      return;
    }

    if (req.method === 'POST' && pathname === '/tasks') {
      const data = await readData();
      const body = querystring.parse(await getBody(req));
      const title = (body.title || '').trim();
      const owner = body.owner;

      if (title.length < 3 || !data.users.includes(owner)) {
        redirect(res, `/?user=${encodeURIComponent(owner || data.users[0])}&error=invalid`);
        return;
      }

      data.tasks.unshift({
        id: getNextTaskId(data.tasks),
        title,
        owner,
        done: false,
        createdAt: new Date().toISOString()
      });

      await writeData(data);
      redirect(res, `/?user=${encodeURIComponent(owner)}`);
      return;
    }

    const toggleMatch = pathname.match(/^\/tasks\/(\d+)\/toggle$/);
    if (req.method === 'POST' && toggleMatch) {
      const data = await readData();
      const taskId = Number(toggleMatch[1]);
      const task = data.tasks.find((item) => item.id === taskId);
      if (task) {
        task.done = !task.done;
        await writeData(data);
      }
      const user = currentUrl.searchParams.get('user') || data.users[0];
      redirect(res, `/?user=${encodeURIComponent(user)}`);
      return;
    }

    const deleteMatch = pathname.match(/^\/tasks\/(\d+)\/delete$/);
    if (req.method === 'POST' && deleteMatch) {
      const data = await readData();
      const taskId = Number(deleteMatch[1]);
      data.tasks = data.tasks.filter((item) => item.id !== taskId);
      await writeData(data);
      const user = currentUrl.searchParams.get('user') || data.users[0];
      redirect(res, `/?user=${encodeURIComponent(user)}`);
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not Found');
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Internal Server Error: ${error.message}`);
  }
}

module.exports = app;
