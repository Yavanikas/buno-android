import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Buno backend running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
