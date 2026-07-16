'use client';

import type {ReactElement} from 'react';
import {UploadComponent, type UploadUrlParams} from '../src/routes/upload';

export default function UploadPageClient({initialParams}: {initialParams: UploadUrlParams}): ReactElement {
	return <UploadComponent initialParams={initialParams} />;
}
