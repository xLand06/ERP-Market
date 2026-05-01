import axios from 'axios';

async function testApi() {
    const baseUrl = 'http://127.0.0.1:3001/api';
    // We need a token if it's protected. Assuming we don't have one or can get one.
    // For now let's just see if we can get a response.
    try {
        console.log('Testing /api/products...');
        const res = await axios.get(`${baseUrl}/products?page=1&limit=25&isActive=true`);
        console.log('Products:', res.status, res.data);
    } catch (error: any) {
        if (error.response) {
            console.log('Products Error:', error.response.status, error.response.data);
        } else {
            console.log('Products Error:', error.message);
        }
    }

    try {
        console.log('Testing /api/inventory/stock/branch/branch-sede-a...');
        const res = await axios.get(`${baseUrl}/inventory/stock/branch/branch-sede-a`);
        console.log('Inventory:', res.status, res.data);
    } catch (error: any) {
        if (error.response) {
            console.log('Inventory Error:', error.response.status, error.response.data);
        } else {
            console.log('Inventory Error:', error.message);
        }
    }
}

testApi();
