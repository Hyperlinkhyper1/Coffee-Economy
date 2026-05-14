import 'dotenv/config';

const CURSEFORGE_API_BASE = 'https://api.curseforge.com';
const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY;
const PROJECT_SLUG = 'simply-cozy';
const TARGET_USERNAME = 'hyperlink_hyper';

async function lookup() {
    if (!CURSEFORGE_API_KEY) {
        console.error('CURSEFORGE_API_KEY not found in .env');
        return;
    }

    const headers = {
        'x-api-key': CURSEFORGE_API_KEY,
        'Accept': 'application/json'
    };

    try {
        console.log(`Searching for project: ${PROJECT_SLUG}...`);
        // Search for the mod by slug
        const searchResponse = await fetch(`${CURSEFORGE_API_BASE}/v1/mods/search?gameId=432&slug=${PROJECT_SLUG}`, { headers });
        if (!searchResponse.ok) {
            console.error(`Search failed: ${searchResponse.status}`);
            return;
        }

        const searchData = await searchResponse.json();
        if (!searchData.data || searchData.data.length === 0) {
            console.error('Project not found');
            return;
        }

        const project = searchData.data[0];
        console.log(`Found project: ${project.name} (ID: ${project.id})`);
        console.log('Authors:', JSON.stringify(project.authors, null, 2));

        const author = project.authors.find(a => a.name.toLowerCase() === TARGET_USERNAME.toLowerCase());
        if (author) {
            console.log(`\nSUCCESS! Found user ID for ${TARGET_USERNAME}: ${author.id}`);
        } else {
            console.log(`\nUser ${TARGET_USERNAME} not found among authors.`);
        }
    } catch (error) {
        console.error('Error during lookup:', error);
    }
}

lookup();
