import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler, notFoundHandler } from './middleware/error-handler';
import assetRouter from './routes/assets';
import depreciationRouter from './routes/depreciation';
import healthRouter from './routes/health';
import lookupsRouter from './routes/lookups';
import reportsRouter from './routes/reports';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/health', healthRouter);
app.use('/api/assets', assetRouter);
app.use('/api/depreciation', depreciationRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/lookups', lookupsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
