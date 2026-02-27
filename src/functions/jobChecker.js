const { app } = require('@azure/functions');

app.timer('jobChecker', {
    schedule: '0 */30 * * * *',
    handler: async (myTimer, context) => {
        const time = new Date().toISOString();

        context.log("🚀 Job Alert Bot Running at:", time);

        const jobs = [
            { title: "Azure Cloud Engineer", company: "Microsoft" },
            { title: "Backend Developer", company: "StartupX" }
        ];

        context.log("Jobs found:", jobs);
    }
});