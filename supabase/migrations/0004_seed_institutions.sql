-- Curated 13F filers tracked by the app. CIKs are SEC EDGAR identifiers,
-- zero-padded to 10 digits. Add more rows here to track more institutions;
-- the ingester picks them up automatically on its next run.

insert into institutions (cik, name, slug, manager) values
    ('0001067983', 'Berkshire Hathaway Inc',        'berkshire-hathaway', 'Warren Buffett'),
    ('0001649339', 'Scion Asset Management LLC',    'scion',              'Michael Burry'),
    ('0001336528', 'Pershing Square Capital',       'pershing-square',    'Bill Ackman'),
    ('0001350694', 'Bridgewater Associates LP',     'bridgewater',        'Ray Dalio'),
    ('0001536411', 'Duquesne Family Office LLC',    'duquesne',           'Stanley Druckenmiller'),
    ('0001079114', 'Greenlight Capital Inc',        'greenlight',         'David Einhorn'),
    ('0001061768', 'Baupost Group LLC',             'baupost',            'Seth Klarman'),
    ('0001040273', 'Third Point LLC',               'third-point',        'Daniel Loeb'),
    ('0001037389', 'Renaissance Technologies LLC',  'renaissance',        'Jim Simons (founder)'),
    ('0001029160', 'Soros Fund Management LLC',     'soros',              'George Soros'),
    ('0001697748', 'ARK Investment Management LLC', 'ark-invest',         'Cathie Wood'),
    ('0001167483', 'Tiger Global Management LLC',   'tiger-global',       'Chase Coleman'),
    ('0001656456', 'Appaloosa LP',                  'appaloosa',          'David Tepper'),
    -- Also seeded in 0006 for existing DBs; listed here for fresh installs.
    ('0001697733', 'Founders Fund V Management LLC', 'founders-fund',     'Peter Thiel'),
    ('0001423053', 'Citadel Advisors LLC',           'citadel',           'Ken Griffin'),
    ('0001603466', 'Point72 Asset Management LP',    'point72',           'Steven Cohen'),
    ('0001791786', 'Elliott Investment Management',  'elliott',           'Paul Singer'),
    ('0001135730', 'Coatue Management LLC',          'coatue',            'Philippe Laffont'),
    ('0001103804', 'Viking Global Investors LP',     'viking-global',     'Andreas Halvorsen'),
    ('0001061165', 'Lone Pine Capital LLC',          'lone-pine',         'Steve Mandel'),
    ('0001647251', 'TCI Fund Management Ltd',        'tci',               'Chris Hohn'),
    ('0000921669', 'Icahn Capital / Carl Icahn',     'icahn',             'Carl Icahn'),
    ('0001035674', 'Paulson & Co Inc',               'paulson',           'John Paulson'),
    ('0001541617', 'Altimeter Capital Management',   'altimeter',         'Brad Gerstner'),
    ('0001510281', 'Saba Capital Management LP',     'saba-capital',      'Boaz Weinstein'),
    ('0000923093', 'Tudor Investment Corp',          'tudor',             'Paul Tudor Jones')
on conflict (cik) do nothing;
