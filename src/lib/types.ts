import { Application } from '@prisma/client';

export type MojangUser = {
	id: string;
	name: string;
};

export type Responses = {
	question: string;
	content: string;
}[];

export interface ApplicationManagement {
	getApplication(id: string): Promise<Application | null>;
	postApplication(application: Application): Promise<void>;
	updateApplication(application: Application): Promise<void>;
	deleteApplication(id: string): Promise<void>;
}
