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
    }
];

export function getJob(jobId) {
    return JOBS.find(j => j.id === jobId.toLowerCase()) || JOBS[0];
}

export function getUnlockedJobs(shifts) {
    return JOBS.filter(j => shifts >= j.shiftsRequired);
}
