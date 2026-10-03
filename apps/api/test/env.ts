process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://lumi:lumi@localhost:5432/lumi_test';
process.env.JWT_SECRET = 'test-secret';
