import { createCore } from '@yuelao/core/server';
import site from '../site.config';

// Server singleton: route files only delegate; business logic lives in packages.
export const core = createCore(site);
