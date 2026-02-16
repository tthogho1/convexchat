import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Run cleanup every minute
crons.interval(
  'cleanup old locations and users',
  { minutes: 1 },
  internal.myFunctions.cleanupOldLocationsAndUsers,
  {},
);

export default crons;
