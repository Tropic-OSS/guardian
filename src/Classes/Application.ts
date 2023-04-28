class Application {
	application_id: string;
	user_id: string;
	application_status: string;
	application_answers: JSON;

	constructor(application_id: string, user_id: string, application_status: string, application_answers: JSON) {
		this.application_id = application_id;
		this.user_id = user_id;
		this.application_status = application_status;
		this.application_answers = application_answers;
	}
}
