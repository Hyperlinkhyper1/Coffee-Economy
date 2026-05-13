(async () => {
    const projectId = 'sodium';
    try {
        const response = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`);
        const versions = await response.json();

        if (versions.length > 0) {
            const latest = versions[0];
            console.log('=== MODRINTH VERSION RESPONSE ===');
            console.log('Available fields:');
            console.log(Object.keys(latest).sort());
            console.log('\n=== CHANGELOG FIELDS ===');
            console.log('body:', latest.body);
            console.log('\nname:', latest.name);
            console.log('\nchangelog:', latest.changelog);
            console.log('\n=== FULL OBJECT (first 3000 chars) ===');
            console.log(JSON.stringify(latest, null, 2).substring(0, 3000));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
})();


