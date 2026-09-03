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
    ('0001656456', 'Appaloosa LP',                  'appaloosa',          'David Tepper')
on conflict (cik) do nothing;
