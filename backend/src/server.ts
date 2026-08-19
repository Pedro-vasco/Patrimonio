import app from './app';

const port = Number.parseInt(process.env.PORT ?? '3001', 10);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
