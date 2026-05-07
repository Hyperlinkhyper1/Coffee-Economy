export const JOBS = [
    {
        id: 'janitor',
        name: 'Janitor',
        description: 'Clean up the mess around the city.',
        minPay: 50,
        maxPay: 100,
        shiftsRequired: 0,
        emoji: '🧹'
    },
    {
        id: 'cashier',
        name: 'Cashier',
        description: 'Handle transactions at a local shop.',
        minPay: 100,
        maxPay: 200,
        shiftsRequired: 5,
        emoji: '🛒'
    },
    {
        id: 'pizza_delivery',
        name: 'Pizza Delivery Driver',
        description: 'Deliver hot pizzas to hungry customers.',
        minPay: 150,
        maxPay: 250,
        shiftsRequired: 15,
        emoji: '🍕'
    },
    {
        id: 'barista',
        name: 'Barista',
        description: 'Brew perfect coffee for caffeine addicts.',
        minPay: 200,
        maxPay: 350,
        shiftsRequired: 30,
        emoji: '☕'
    },
    {
        id: 'librarian',
        name: 'Librarian',
        description: 'Organize books and maintain silence.',
        minPay: 250,
        maxPay: 450,
        shiftsRequired: 50,
        emoji: '📚'
    },
    {
        id: 'software_developer',
        name: 'Software Developer',
        description: 'Write code and squash bugs.',
        minPay: 400,
        maxPay: 700,
        shiftsRequired: 100,
        emoji: '💻'
    },
    {
        id: 'bot_developer',
        name: 'Discord Bot Developer',
        description: 'Create the next big Discord bot.',
        minPay: 600,
        maxPay: 1000,
        shiftsRequired: 200,
        emoji: '🤖'
    },
    {
        id: 'banker',
        name: 'Banker',
        description: 'Manage finances at a prestigious bank.',
        minPay: 1500,
        maxPay: 3000,
        shiftsRequired: null,
        bankRequired: 5000000,
        emoji: '💼'
    },
    {
        id: 'cozy_developer',
        name: 'Simply Cozy Developer',
        description: 'The developer of Simply Cozy. Only for the chosen one.',
        minPay: 5000,
        maxPay: 7500,
        shiftsRequired: null,
        allowedUserId: '1080079015165050941',
        emoji: '🛋️'
    }
];

export function getJob(jobId) {
    return JOBS.find(j => j.id === jobId.toLowerCase()) || JOBS[0];
}

export function getUnlockedJobs(shifts, wallet = 0, userId = null) {
    return JOBS.filter(j => {
        if (j.allowedUserId) {
            return userId === j.allowedUserId;
        }
        if (j.bankRequired) {
            return wallet >= j.bankRequired;
        }
        return shifts >= j.shiftsRequired;
    });
}
