create or replace view public.v_contact_overview with (security_invoker = true) as
 SELECT c.id AS contact_id, c.first_name, c.middle_name, c.last_name, c.email, c.phone, c.linkedin_url, c.active,
    cc.company_id, co.name AS company_name, aff.name AS affiliation_type, cc.title, fn.name AS job_function,
    lab.labels, lab.rank, lab.rank IS NOT NULL AND lab.rank <= 3 AS is_decision_maker,
    COALESCE(l.id, hq.id) AS location_id, COALESCE(l.city, hq.city) AS city, COALESCE(l.postal_code, hq.postal_code) AS postal_code,
    pc.municipality, pc.region, cc.location_id IS NULL AND hq.id IS NOT NULL AS location_assumed,
    cc.start_date
   FROM contact c
     LEFT JOIN contact_company cc ON cc.contact_id = c.id AND cc.is_primary AND cc.end_date IS NULL
     LEFT JOIN company co ON co.id = cc.company_id
     LEFT JOIN affiliation_type aff ON aff.id = cc.affiliation_type_id
     LEFT JOIN job_function fn ON fn.id = cc.function_id
     LEFT JOIN company_location l ON l.id = cc.location_id
     LEFT JOIN company_location hq ON hq.company_id = cc.company_id AND hq.is_hq AND cc.location_id IS NULL
     LEFT JOIN postcode pc ON pc.postal_code = COALESCE(l.postal_code, hq.postal_code)
     LEFT JOIN LATERAL ( SELECT string_agg(lv.name, ', '::text ORDER BY lv.sort_order) AS labels,
            min(lv.sort_order) FILTER (WHERE lv.is_ranked) AS rank
           FROM contact_company a
             JOIN contact_company_level x ON x.contact_company_id = a.id
             JOIN level lv ON lv.id = x.level_id
          WHERE a.contact_id = c.id AND a.end_date IS NULL) lab ON true;
