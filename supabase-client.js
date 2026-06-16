// Supabase Client Initialization (Pure Fetch API - No CDN required)

const SUPABASE_URL = 'https://jnknaljkszavgdntrfzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impua25hbGprc3phdmdkbnRyZnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTYyNzAsImV4cCI6MjA5NjgzMjI3MH0.koG3QgPMaFCGoPfgbOINRATs_yf2bHwb4EpuzFENdHY';

const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
};

// Utility functions for Database interactions
window.db = {
    async fetchJamaah() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/jamaah?select=*`, { headers });
            if (!res.ok) throw new Error(await res.text());
            return await res.json();
        } catch (error) {
            console.error("Error fetching jamaah:", error);
            throw error; // Throw so app.js catch block triggers LocalStorage fallback
        }
    },
    
    async fetchAttendance() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?select=*`, { headers });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            return data.map(log => ({
                id: log.id,
                date: log.date,
                memberId: log.member_id,
                status: log.status,
                present: log.present
            }));
        } catch (error) {
            console.error("Error fetching attendance:", error);
            throw error;
        }
    },

    async upsertJamaah(member) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/jamaah`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify({
                    id: member.id,
                    name: member.name,
                    gender: member.gender,
                    category: member.category,
                    phone: member.phone,
                    address: member.address
                })
            });
            if (!res.ok) console.error("Error upserting jamaah:", await res.text());
        } catch (error) {
            console.error("Fetch error upserting jamaah:", error);
        }
    },

    async deleteJamaah(memberId) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/jamaah?id=eq.${memberId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) console.error("Error deleting jamaah:", await res.text());
        } catch (error) {
            console.error("Fetch error deleting jamaah:", error);
        }
    },

    async insertAttendance(log) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify({
                    id: log.id,
                    date: log.date,
                    member_id: log.memberId,
                    status: log.status,
                    present: log.present
                })
            });
            if (!res.ok) console.error("Error inserting attendance:", await res.text());
        } catch (error) {
            console.error("Fetch error inserting attendance:", error);
        }
    },

    async updateAttendanceStatus(id, status, present) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: status, present: present })
            });
            if (!res.ok) console.error("Error updating attendance:", await res.text());
        } catch (error) {
            console.error("Fetch error updating attendance:", error);
        }
    },

    async deleteAttendance(id) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/attendance?id=eq.${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) console.error("Error deleting attendance:", await res.text());
        } catch (error) {
            console.error("Fetch error deleting attendance:", error);
        }
    }
};
