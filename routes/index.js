const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();
const dataFile = path.join(__dirname, '..', 'data', 'tasks.json');

async function readData() {
  const rawData = await fs.readFile(dataFile, 'utf-8');
  return JSON.parse(rawData);
}

async function writeData(data) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2));
}

function nextTaskId(tasks) {
  if (!tasks.length) {
    return 1;
  }

  return Math.max(...tasks.map((task) => task.id)) + 1;
}

router.get('/', async function(req, res, next) {
  try {
    const data = await readData();
    const selectedUser = data.users.includes(req.query.user) ? req.query.user : data.users[0];

    res.render('index', {
      users: data.users,
      selectedUser,
      tasks: data.tasks,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tasks', async function(req, res, next) {
  try {
    const data = await readData();
    const title = (req.body.title || '').trim();
    const owner = req.body.owner;

    if (title.length < 3 || !data.users.includes(owner)) {
      return res.redirect(`/?user=${encodeURIComponent(owner || data.users[0])}&error=invalid`);
    }

    data.tasks.unshift({
      id: nextTaskId(data.tasks),
      title,
      owner,
      done: false,
      createdAt: new Date().toISOString()
    });

    await writeData(data);
    res.redirect(`/?user=${encodeURIComponent(owner)}`);
  } catch (error) {
    next(error);
  }
});

router.post('/tasks/:id/toggle', async function(req, res, next) {
  try {
    const data = await readData();
    const taskId = Number(req.params.id);
    const task = data.tasks.find((item) => item.id === taskId);

    if (task) {
      task.done = !task.done;
      await writeData(data);
    }

    res.redirect(`/?user=${encodeURIComponent(req.query.user || data.users[0])}`);
  } catch (error) {
    next(error);
  }
});

router.post('/tasks/:id/delete', async function(req, res, next) {
  try {
    const data = await readData();
    const taskId = Number(req.params.id);
    data.tasks = data.tasks.filter((item) => item.id !== taskId);

    await writeData(data);
    res.redirect(`/?user=${encodeURIComponent(req.query.user || data.users[0])}`);
  } catch (error) {
    next(error);
  }
});

router.get('/api/tasks', async function(req, res, next) {
  try {
    const data = await readData();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
