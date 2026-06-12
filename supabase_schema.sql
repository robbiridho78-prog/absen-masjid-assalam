-- Skema Database untuk Absen Jamaah Assalam

-- 1. Tabel Jamaah
CREATE TABLE public.jamaah (
    id text PRIMARY KEY,
    name text NOT NULL,
    gender text NOT NULL,
    category text NOT NULL,
    phone text,
    address text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Attendance (Kehadiran)
CREATE TABLE public.attendance (
    id text PRIMARY KEY,
    date text NOT NULL,
    member_id text NOT NULL REFERENCES public.jamaah(id) ON DELETE CASCADE,
    status text NOT NULL,
    present boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan Row Level Security (RLS) namun memberikan akses penuh untuk anonim sementara (karena tidak ada sistem login)
ALTER TABLE public.jamaah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read jamaah" ON public.jamaah FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert jamaah" ON public.jamaah FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update jamaah" ON public.jamaah FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete jamaah" ON public.jamaah FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous update attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Allow anonymous delete attendance" ON public.attendance FOR DELETE USING (true);
