-- Additional famous 13F managers. Safe to re-run: on conflict do nothing.
-- Michael Burry (Scion) is already in 0004_seed_institutions.sql.

insert into institutions (cik, name, slug, manager) values
    ('0001697733', 'Founders Fund V Management LLC', 'founders-fund',       'Peter Thiel'),
    ('0001423053', 'Citadel Advisors LLC',           'citadel',             'Ken Griffin'),
    ('0001603466', 'Point72 Asset Management LP',    'point72',             'Steven Cohen'),
    ('0001791786', 'Elliott Investment Management',  'elliott',             'Paul Singer'),
    ('0001135730', 'Coatue Management LLC',          'coatue',              'Philippe Laffont'),
    ('0001103804', 'Viking Global Investors LP',     'viking-global',       'Andreas Halvorsen'),
    ('0001061165', 'Lone Pine Capital LLC',          'lone-pine',           'Steve Mandel'),
    ('0001647251', 'TCI Fund Management Ltd',        'tci',                 'Chris Hohn'),
    ('0000921669', 'Icahn Capital / Carl Icahn',     'icahn',               'Carl Icahn'),
    ('0001035674', 'Paulson & Co Inc',               'paulson',             'John Paulson'),
    ('0001541617', 'Altimeter Capital Management',   'altimeter',           'Brad Gerstner'),
    ('0001510281', 'Saba Capital Management LP',     'saba-capital',        'Boaz Weinstein'),
    ('0000923093', 'Tudor Investment Corp',          'tudor',               'Paul Tudor Jones')
on conflict (cik) do nothing;
