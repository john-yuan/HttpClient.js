var SpecReporter = require('jasmine-spec-reporter').SpecReporter;

// remove default reporter logs
jasmine.getEnv().clearReporters();

// add jasmine-spec-reporter
jasmine.getEnv().addReporter(new SpecReporter({
    spec: {
        displayPending: true
    },
    summary: {
        displayDuration: false
    }
}));
