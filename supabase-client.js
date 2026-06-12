// Supabase Client Initialization

const SUPABASE_URL = 'https://jnknaljkszavgdntrfzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impua25hbGprc3phdmdkbnRyZnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNTYyNzAsImV4cCI6MjA5NjgzMjI3MH0.koG3QgPMaFCGoPfgbOINRATs_yf2bHwb4EpuzFENdHY';

// Initialize the Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utility functions for Database interactions
window.db = {
    async fetchJamaah() {
        const { data, error } = await supabase.from('jamaah').select('*');
        if (error) {
            console.error("Error fetching jamaah:", error);
            return [];
        }
        return data;
    },
    
    async fetchAttendance() {
        const { data, error } = await supabase.from('attendance').select('*');
        if (error) {
            console.error("Error fetching attendance:", error);
            return [];
        }
        // Map member_id back to memberId for frontend compatibility
        return data.map(log => ({
            id: log.id,
            date: log.date,
            memberId: log.member_id,
            status: log.status,
            present: log.present
        }));
    },

    async upsertJamaah(member) {
        const { error } = await supabase.from('jamaah').upsert({
            id: member.id,
            name: member.name,
            gender: member.gender,
            category: member.category,
            phone: member.phone,
            address: member.address
        });
        if (error) console.error("Error upserting jamaah:", error);
    },

    async deleteJamaah(memberId) {
        const { error } = await supabase.from('jamaah').delete().eq('id', memberId);
        if (error) console.error("Error deleting jamaah:", error);
    },

    async insertAttendance(log) {
        const { error } = await supabase.from('attendance').insert({
            id: log.id,
            date: log.date,
            member_id: log.memberId,
            status: log.status,
            present: log.present
        });
        if (error) console.error("Error inserting attendance:", error);
    },

    async updateAttendanceStatus(id, status, present) {
        const { error } = await supabase.from('attendance')
            .update({ status: status, present: present })
            .eq('id', id);
        if (error) console.error("Error updating attendance:", error);
    },

    async deleteAttendance(id) {
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) console.error("Error deleting attendance:", error);
    }
};
