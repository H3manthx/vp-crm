--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: sync_corporate_last_quote(); Type: FUNCTION; Schema: public; Owner: crm_user
--

CREATE FUNCTION public.sync_corporate_last_quote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  target_lead_id integer := COALESCE(NEW.corporate_lead_id, OLD.corporate_lead_id);
  latest_amount  numeric(12,2);
  latest_at      timestamptz;
BEGIN
  -- Recompute from the newest quote (or NULL if none exist)
  SELECT q.amount, q.created_at
    INTO latest_amount, latest_at
  FROM corporate_lead_quotes q
  WHERE q.corporate_lead_id = target_lead_id
  ORDER BY q.created_at DESC, q.quote_id DESC
  LIMIT 1;

  UPDATE corporate_leads
     SET last_quoted_value = latest_amount,
         last_quoted_at    = latest_at
   WHERE corporate_lead_id = target_lead_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.sync_corporate_last_quote() OWNER TO crm_user;

--
-- Name: trg_log_corp_lead_status(); Type: FUNCTION; Schema: public; Owner: crm_user
--

CREATE FUNCTION public.trg_log_corp_lead_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO corporate_lead_status_history (corporate_lead_id, status, notes, updated_by, update_timestamp)
    VALUES (NEW.corporate_lead_id, COALESCE(NEW.status, 'New'), 'Lead created', NEW.manager_id, NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO corporate_lead_status_history (corporate_lead_id, status, notes, updated_by, update_timestamp)
      VALUES (NEW.corporate_lead_id, NEW.status, NULL, NEW.manager_id, NOW());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_log_corp_lead_status() OWNER TO crm_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: corporate_lead_documents; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_lead_documents (
    doc_id integer NOT NULL,
    corporate_lead_id integer NOT NULL,
    doc_type text NOT NULL,
    file_name text NOT NULL,
    stored_path text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    uploaded_by integer,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.corporate_lead_documents OWNER TO crm_user;

--
-- Name: corporate_lead_documents_doc_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_lead_documents_doc_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_lead_documents_doc_id_seq OWNER TO crm_user;

--
-- Name: corporate_lead_documents_doc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_lead_documents_doc_id_seq OWNED BY public.corporate_lead_documents.doc_id;


--
-- Name: corporate_lead_items; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_lead_items (
    item_id integer NOT NULL,
    corporate_lead_id integer,
    bill_of_material character varying(100),
    quantity integer DEFAULT 1,
    requirements text,
    last_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.corporate_lead_items OWNER TO crm_user;

--
-- Name: corporate_lead_items_item_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_lead_items_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_lead_items_item_id_seq OWNER TO crm_user;

--
-- Name: corporate_lead_items_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_lead_items_item_id_seq OWNED BY public.corporate_lead_items.item_id;


--
-- Name: corporate_lead_quotes; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_lead_quotes (
    quote_id integer NOT NULL,
    corporate_lead_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.corporate_lead_quotes OWNER TO crm_user;

--
-- Name: corporate_lead_quotes_quote_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_lead_quotes_quote_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_lead_quotes_quote_id_seq OWNER TO crm_user;

--
-- Name: corporate_lead_quotes_quote_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_lead_quotes_quote_id_seq OWNED BY public.corporate_lead_quotes.quote_id;


--
-- Name: corporate_lead_reminders; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_lead_reminders (
    reminder_id integer NOT NULL,
    corporate_lead_id integer,
    remind_at timestamp with time zone NOT NULL,
    reminder_type text NOT NULL,
    done boolean DEFAULT false,
    notes text
);


ALTER TABLE public.corporate_lead_reminders OWNER TO crm_user;

--
-- Name: corporate_lead_reminders_reminder_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_lead_reminders_reminder_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_lead_reminders_reminder_id_seq OWNER TO crm_user;

--
-- Name: corporate_lead_reminders_reminder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_lead_reminders_reminder_id_seq OWNED BY public.corporate_lead_reminders.reminder_id;


--
-- Name: corporate_lead_status_history; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_lead_status_history (
    status_id integer NOT NULL,
    corporate_lead_id integer NOT NULL,
    status text NOT NULL,
    notes text,
    updated_by integer,
    update_timestamp timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.corporate_lead_status_history OWNER TO crm_user;

--
-- Name: corporate_lead_status_history_status_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_lead_status_history_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_lead_status_history_status_id_seq OWNER TO crm_user;

--
-- Name: corporate_lead_status_history_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_lead_status_history_status_id_seq OWNED BY public.corporate_lead_status_history.status_id;


--
-- Name: corporate_leads; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.corporate_leads (
    corporate_lead_id integer NOT NULL,
    name character varying(100) NOT NULL,
    contact_number character varying(20) NOT NULL,
    email character varying(100),
    enquiry_date date DEFAULT CURRENT_DATE NOT NULL,
    status character varying(100),
    closed_date date,
    manager_id integer,
    last_quoted_value numeric(12,2),
    last_quoted_at timestamp with time zone
);


ALTER TABLE public.corporate_leads OWNER TO crm_user;

--
-- Name: corporate_leads_corporate_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.corporate_leads_corporate_lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.corporate_leads_corporate_lead_id_seq OWNER TO crm_user;

--
-- Name: corporate_leads_corporate_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.corporate_leads_corporate_lead_id_seq OWNED BY public.corporate_leads.corporate_lead_id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.employees (
    employee_id integer NOT NULL,
    name character varying(100),
    email character varying(100),
    password character varying(255),
    role character varying(100),
    store_id integer
);


ALTER TABLE public.employees OWNER TO crm_user;

--
-- Name: employees_employee_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.employees_employee_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employees_employee_id_seq OWNER TO crm_user;

--
-- Name: employees_employee_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.employees_employee_id_seq OWNED BY public.employees.employee_id;


--
-- Name: lead_items; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.lead_items (
    lead_item_id integer NOT NULL,
    lead_id integer,
    item_description character varying(100),
    category character varying(100),
    brand character varying(100),
    quantity integer DEFAULT 1
);


ALTER TABLE public.lead_items OWNER TO crm_user;

--
-- Name: lead_items_lead_item_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.lead_items_lead_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_items_lead_item_id_seq OWNER TO crm_user;

--
-- Name: lead_items_lead_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.lead_items_lead_item_id_seq OWNED BY public.lead_items.lead_item_id;


--
-- Name: lead_status_history; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.lead_status_history (
    status_id integer NOT NULL,
    lead_id integer,
    status character varying(100),
    updated_by integer,
    update_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.lead_status_history OWNER TO crm_user;

--
-- Name: lead_status_history_status_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.lead_status_history_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_status_history_status_id_seq OWNER TO crm_user;

--
-- Name: lead_status_history_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.lead_status_history_status_id_seq OWNED BY public.lead_status_history.status_id;


--
-- Name: lead_transfers; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.lead_transfers (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    from_employee_id integer NOT NULL,
    to_employee_id integer NOT NULL,
    transfer_date timestamp without time zone DEFAULT now(),
    transfer_reason text
);


ALTER TABLE public.lead_transfers OWNER TO crm_user;

--
-- Name: lead_transfers_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.lead_transfers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_transfers_id_seq OWNER TO crm_user;

--
-- Name: lead_transfers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.lead_transfers_id_seq OWNED BY public.lead_transfers.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.leads (
    lead_id integer NOT NULL,
    store_id integer,
    name character varying(100) NOT NULL,
    contact_number character varying(20) NOT NULL,
    email character varying(100),
    source character varying(100),
    source_detail character varying(100),
    enquiry_date date DEFAULT CURRENT_DATE NOT NULL,
    created_by integer,
    assigned_to integer,
    assigned_by integer,
    status character varying(100) DEFAULT 'New'::character varying,
    value_closed numeric,
    closed_date date
);


ALTER TABLE public.leads OWNER TO crm_user;

--
-- Name: leads_lead_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.leads_lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leads_lead_id_seq OWNER TO crm_user;

--
-- Name: leads_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.leads_lead_id_seq OWNED BY public.leads.lead_id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.stores (
    store_id integer NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    address text
);


ALTER TABLE public.stores OWNER TO crm_user;

--
-- Name: manager_leads_export; Type: VIEW; Schema: public; Owner: crm_user
--

CREATE VIEW public.manager_leads_export AS
 SELECT l.name AS customer_name,
    l.email,
    l.contact_number,
    l.status,
    l.enquiry_date,
    li.category AS item_category,
    li.brand AS item_brand,
    li.item_description,
    s.name AS store_name,
    COALESCE(e_created.name, e_created.email) AS created_by,
    COALESCE(e_assigned.name, e_assigned.email) AS assigned_to
   FROM ((((public.leads l
     LEFT JOIN public.lead_items li ON ((li.lead_id = l.lead_id)))
     LEFT JOIN public.stores s ON ((s.store_id = l.store_id)))
     LEFT JOIN public.employees e_created ON ((e_created.employee_id = l.created_by)))
     LEFT JOIN public.employees e_assigned ON ((e_assigned.employee_id = l.assigned_to)));


ALTER VIEW public.manager_leads_export OWNER TO crm_user;

--
-- Name: retail_lead_reminders; Type: TABLE; Schema: public; Owner: crm_user
--

CREATE TABLE public.retail_lead_reminders (
    reminder_id integer NOT NULL,
    lead_id integer,
    remind_at timestamp with time zone NOT NULL,
    reason text NOT NULL,
    done boolean DEFAULT false
);


ALTER TABLE public.retail_lead_reminders OWNER TO crm_user;

--
-- Name: retail_lead_reminders_reminder_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.retail_lead_reminders_reminder_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.retail_lead_reminders_reminder_id_seq OWNER TO crm_user;

--
-- Name: retail_lead_reminders_reminder_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.retail_lead_reminders_reminder_id_seq OWNED BY public.retail_lead_reminders.reminder_id;


--
-- Name: stores_store_id_seq; Type: SEQUENCE; Schema: public; Owner: crm_user
--

CREATE SEQUENCE public.stores_store_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stores_store_id_seq OWNER TO crm_user;

--
-- Name: stores_store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: crm_user
--

ALTER SEQUENCE public.stores_store_id_seq OWNED BY public.stores.store_id;


--
-- Name: corporate_lead_documents doc_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_documents ALTER COLUMN doc_id SET DEFAULT nextval('public.corporate_lead_documents_doc_id_seq'::regclass);


--
-- Name: corporate_lead_items item_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_items ALTER COLUMN item_id SET DEFAULT nextval('public.corporate_lead_items_item_id_seq'::regclass);


--
-- Name: corporate_lead_quotes quote_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_quotes ALTER COLUMN quote_id SET DEFAULT nextval('public.corporate_lead_quotes_quote_id_seq'::regclass);


--
-- Name: corporate_lead_reminders reminder_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_reminders ALTER COLUMN reminder_id SET DEFAULT nextval('public.corporate_lead_reminders_reminder_id_seq'::regclass);


--
-- Name: corporate_lead_status_history status_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_status_history ALTER COLUMN status_id SET DEFAULT nextval('public.corporate_lead_status_history_status_id_seq'::regclass);


--
-- Name: corporate_leads corporate_lead_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_leads ALTER COLUMN corporate_lead_id SET DEFAULT nextval('public.corporate_leads_corporate_lead_id_seq'::regclass);


--
-- Name: employees employee_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.employees ALTER COLUMN employee_id SET DEFAULT nextval('public.employees_employee_id_seq'::regclass);


--
-- Name: lead_items lead_item_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_items ALTER COLUMN lead_item_id SET DEFAULT nextval('public.lead_items_lead_item_id_seq'::regclass);


--
-- Name: lead_status_history status_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_status_history ALTER COLUMN status_id SET DEFAULT nextval('public.lead_status_history_status_id_seq'::regclass);


--
-- Name: lead_transfers id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_transfers ALTER COLUMN id SET DEFAULT nextval('public.lead_transfers_id_seq'::regclass);


--
-- Name: leads lead_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads ALTER COLUMN lead_id SET DEFAULT nextval('public.leads_lead_id_seq'::regclass);


--
-- Name: retail_lead_reminders reminder_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.retail_lead_reminders ALTER COLUMN reminder_id SET DEFAULT nextval('public.retail_lead_reminders_reminder_id_seq'::regclass);


--
-- Name: stores store_id; Type: DEFAULT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.stores ALTER COLUMN store_id SET DEFAULT nextval('public.stores_store_id_seq'::regclass);


--
-- Data for Name: corporate_lead_documents; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_lead_documents (doc_id, corporate_lead_id, doc_type, file_name, stored_path, mime_type, file_size, uploaded_by, uploaded_at) FROM stdin;
\.


--
-- Data for Name: corporate_lead_items; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_lead_items (item_id, corporate_lead_id, bill_of_material, quantity, requirements, last_updated) FROM stdin;
1	1	Workstations	5	16GB RAM, 1TB SSD, RTX 2080 6GB VRAM	2025-08-16 13:28:28.389678+00
2	2	laptops	10	Lenovo Yoga 16GB RAM, OLED Screen	2025-08-18 07:06:26.937026+00
3	3	Workstations	5	Apple MacBook Pro	2025-08-18 07:12:39.01898+00
\.


--
-- Data for Name: corporate_lead_quotes; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_lead_quotes (quote_id, corporate_lead_id, amount, notes, created_at) FROM stdin;
1	1	1000000.00	Budget mentioned	2025-08-16 13:28:28.402283+00
2	2	1200000.00	Initial Budget	2025-08-18 07:06:26.948102+00
3	3	800000.00	Initial Budget	2025-08-18 07:12:39.030714+00
\.


--
-- Data for Name: corporate_lead_reminders; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_lead_reminders (reminder_id, corporate_lead_id, remind_at, reminder_type, done, notes) FROM stdin;
1	2	2025-08-21 07:06:26.877366+00	lead_checkin	t	Check in on new lead
2	2	2025-08-21 07:07:58.989176+00	lead_checkin	t	Recurring 3-day check-in
3	2	2025-08-21 07:08:01.538485+00	lead_checkin	t	Recurring 3-day check-in
4	2	2025-08-21 07:08:02.852059+00	lead_checkin	t	Recurring 3-day check-in
5	2	2025-08-21 07:08:03.828236+00	lead_checkin	t	Recurring 3-day check-in
6	2	2025-08-21 07:08:04.55934+00	lead_checkin	t	Recurring 3-day check-in
7	2	2025-08-21 07:08:04.731396+00	lead_checkin	t	Recurring 3-day check-in
8	2	2025-08-21 07:08:04.914818+00	lead_checkin	t	Recurring 3-day check-in
9	2	2025-08-21 07:08:05.22036+00	lead_checkin	t	Recurring 3-day check-in
10	2	2025-08-21 07:08:05.380044+00	lead_checkin	t	Recurring 3-day check-in
11	2	2025-08-21 07:10:33.902509+00	lead_checkin	t	Recurring 3-day check-in
12	3	2025-08-21 07:12:38.982388+00	lead_checkin	t	Check in on new lead
13	2	2025-08-22 06:49:20.771284+00	lead_checkin	t	Recurring 3-day check-in
15	2	2025-08-22 06:50:11.457964+00	lead_checkin	f	Recurring 3-day check-in
14	3	2025-08-22 06:49:21.936784+00	lead_checkin	t	Recurring 3-day check-in
16	3	2025-08-22 06:50:12.654253+00	lead_checkin	f	Recurring 3-day check-in
\.


--
-- Data for Name: corporate_lead_status_history; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_lead_status_history (status_id, corporate_lead_id, status, notes, updated_by, update_timestamp) FROM stdin;
1	1	New	Lead created	1	2025-08-16 13:28:28.332899+00
2	1	New	Lead created	1	2025-08-16 13:28:28.377451+00
3	2	New	Lead created	1	2025-08-18 07:06:26.877366+00
4	2	New	Lead created	1	2025-08-18 07:06:26.877366+00
5	3	New	Lead created	1	2025-08-18 07:12:38.982388+00
6	3	New	Lead created	1	2025-08-18 07:12:38.982388+00
\.


--
-- Data for Name: corporate_leads; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.corporate_leads (corporate_lead_id, name, contact_number, email, enquiry_date, status, closed_date, manager_id, last_quoted_value, last_quoted_at) FROM stdin;
1	BlueTech Logistics	9173540837	bluetech@gmail.com	2025-08-16	New	\N	1	1000000.00	2025-08-16 13:28:28.402283+00
2	xyz	8345034599	xyz@gmail.com	2025-08-18	New	\N	1	1200000.00	2025-08-18 07:06:26.948102+00
3	Alphabet Inc.	9046265399	Alphabet@gmail.com	2025-08-18	New	\N	1	800000.00	2025-08-18 07:12:39.030714+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.employees (employee_id, name, email, password, role, store_id) FROM stdin;
4	Roshan Jacob Tom	roshanjacobtom@gmail.com	$2b$10$FYWXggj21NoCmUkJ0X0h/Omz35v/GyA2OB53MLkTaD6koKbxqW6V.	sales	3
1	Hemanth Jayan	hemanth120911@gmail.com	$2b$10$iO4MxBE/qQl2sJLApNwWVu6diCmX4qNNUts/EuRr9HqBMbm.fsLYy	corporate_manager	1
2	Aravindhan PM	aravindhanpm@gmail.com	$2b$10$aYEd55gGkAk3y46RegxtVe/nVD.TD4yWz1xySIHVOXGGqcdhmn0Xi	laptop_manager	1
3	Prashasthi Singh	prashasthisingh@gmail.com	$2b$10$viX57vzbaOXVxdHGdJhZT.x3tBmEbOIE.GN5Zgpkv/WvP31rbDU56	pc_manager	1
\.


--
-- Data for Name: lead_items; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.lead_items (lead_item_id, lead_id, item_description, category, brand, quantity) FROM stdin;
1	1	M1 Pro 16GB RAM, 1TB SSD, Latest chip	laptop	Apple	1
2	2	Vengeance 32GB RAM	pc_component	Corsair	1
3	3	\N	pc_component	Crucial	1
4	4	\N	laptop	Lenovo	1
\.


--
-- Data for Name: lead_status_history; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.lead_status_history (status_id, lead_id, status, updated_by, update_timestamp, notes) FROM stdin;
1	1	New	4	2025-08-16 13:03:56.778792+00	Lead created
2	2	New	4	2025-08-16 13:05:18.525907+00	Lead created
3	1	Assigned	2	2025-08-16 13:06:07.232717+00	Assigned to #2
4	1	In Progress	2	2025-08-16 13:26:06.604558+00	Offered first quote.
5	3	New	3	2025-08-18 05:36:34.490769+00	Lead created
6	3	Assigned	3	2025-08-18 05:37:12.548733+00	Assigned to #3
7	3	In Progress	3	2025-08-18 05:38:42.718969+00	quoted\n
8	4	New	2	2025-08-18 06:26:50.948824+00	Lead created
\.


--
-- Data for Name: lead_transfers; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.lead_transfers (id, lead_id, from_employee_id, to_employee_id, transfer_date, transfer_reason) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.leads (lead_id, store_id, name, contact_number, email, source, source_detail, enquiry_date, created_by, assigned_to, assigned_by, status, value_closed, closed_date) FROM stdin;
2	\N	Vijaylaxmi	912348596	vijaylaxmi@gmail.com	Online	Meta Ads	2025-08-16	4	\N	\N	New	\N	\N
1	3	Pehchan	9156245831	pehchan@gmail.com	Walk-In	\N	2025-08-16	4	2	2	In Progress	\N	\N
3	\N	pp	3456	\N	online	meta	2025-08-18	3	3	3	In Progress	\N	\N
4	2	Aravind	8940563399	\N	walkin	\N	2025-08-18	2	\N	\N	New	\N	\N
\.


--
-- Data for Name: retail_lead_reminders; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.retail_lead_reminders (reminder_id, lead_id, remind_at, reason, done) FROM stdin;
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: crm_user
--

COPY public.stores (store_id, name, city, address) FROM stdin;
3	VP Ameerpet	Hyderabad	Shop No: 28, Aditya Enclave, Annapurna Block, Telangana - 500016
2	VP CTC Store	Hyderabad	Shop No: 13/14, Ground Floor, CTC, Secunderabad, Telangana - 500003
1	VP Corporate Office	Hyderabad	Shop No #319, 3rd Floor, ‘A’ Block, CTC, Parklane, Secunderabad – 500003
\.


--
-- Name: corporate_lead_documents_doc_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_lead_documents_doc_id_seq', 1, false);


--
-- Name: corporate_lead_items_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_lead_items_item_id_seq', 3, true);


--
-- Name: corporate_lead_quotes_quote_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_lead_quotes_quote_id_seq', 3, true);


--
-- Name: corporate_lead_reminders_reminder_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_lead_reminders_reminder_id_seq', 16, true);


--
-- Name: corporate_lead_status_history_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_lead_status_history_status_id_seq', 6, true);


--
-- Name: corporate_leads_corporate_lead_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.corporate_leads_corporate_lead_id_seq', 3, true);


--
-- Name: employees_employee_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.employees_employee_id_seq', 4, true);


--
-- Name: lead_items_lead_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.lead_items_lead_item_id_seq', 4, true);


--
-- Name: lead_status_history_status_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.lead_status_history_status_id_seq', 8, true);


--
-- Name: lead_transfers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.lead_transfers_id_seq', 1, false);


--
-- Name: leads_lead_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.leads_lead_id_seq', 4, true);


--
-- Name: retail_lead_reminders_reminder_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.retail_lead_reminders_reminder_id_seq', 1, false);


--
-- Name: stores_store_id_seq; Type: SEQUENCE SET; Schema: public; Owner: crm_user
--

SELECT pg_catalog.setval('public.stores_store_id_seq', 1, true);


--
-- Name: corporate_lead_documents corporate_lead_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_documents
    ADD CONSTRAINT corporate_lead_documents_pkey PRIMARY KEY (doc_id);


--
-- Name: corporate_lead_items corporate_lead_items_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_items
    ADD CONSTRAINT corporate_lead_items_pkey PRIMARY KEY (item_id);


--
-- Name: corporate_lead_quotes corporate_lead_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_quotes
    ADD CONSTRAINT corporate_lead_quotes_pkey PRIMARY KEY (quote_id);


--
-- Name: corporate_lead_reminders corporate_lead_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_reminders
    ADD CONSTRAINT corporate_lead_reminders_pkey PRIMARY KEY (reminder_id);


--
-- Name: corporate_lead_status_history corporate_lead_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_status_history
    ADD CONSTRAINT corporate_lead_status_history_pkey PRIMARY KEY (status_id);


--
-- Name: corporate_leads corporate_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_leads
    ADD CONSTRAINT corporate_leads_pkey PRIMARY KEY (corporate_lead_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (employee_id);


--
-- Name: lead_items lead_items_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_items
    ADD CONSTRAINT lead_items_pkey PRIMARY KEY (lead_item_id);


--
-- Name: lead_status_history lead_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_pkey PRIMARY KEY (status_id);


--
-- Name: lead_transfers lead_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_transfers
    ADD CONSTRAINT lead_transfers_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (lead_id);


--
-- Name: retail_lead_reminders retail_lead_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.retail_lead_reminders
    ADD CONSTRAINT retail_lead_reminders_pkey PRIMARY KEY (reminder_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);


--
-- Name: idx_corp_docs_lead; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_corp_docs_lead ON public.corporate_lead_documents USING btree (corporate_lead_id);


--
-- Name: idx_corp_leads_status; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_corp_leads_status ON public.corporate_leads USING btree (status);


--
-- Name: idx_corp_quotes_lead; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_corp_quotes_lead ON public.corporate_lead_quotes USING btree (corporate_lead_id, created_at DESC);


--
-- Name: idx_corp_status_hist_lead; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_corp_status_hist_lead ON public.corporate_lead_status_history USING btree (corporate_lead_id);


--
-- Name: idx_lead_items_lead_id; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_lead_items_lead_id ON public.lead_items USING btree (lead_id);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: crm_user
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: corporate_leads corp_lead_status_ins; Type: TRIGGER; Schema: public; Owner: crm_user
--

CREATE TRIGGER corp_lead_status_ins AFTER INSERT ON public.corporate_leads FOR EACH ROW EXECUTE FUNCTION public.trg_log_corp_lead_status();


--
-- Name: corporate_leads corp_lead_status_upd; Type: TRIGGER; Schema: public; Owner: crm_user
--

CREATE TRIGGER corp_lead_status_upd AFTER UPDATE OF status ON public.corporate_leads FOR EACH ROW EXECUTE FUNCTION public.trg_log_corp_lead_status();


--
-- Name: corporate_lead_quotes trg_sync_corp_last_quote_iud; Type: TRIGGER; Schema: public; Owner: crm_user
--

CREATE TRIGGER trg_sync_corp_last_quote_iud AFTER INSERT OR DELETE OR UPDATE ON public.corporate_lead_quotes FOR EACH ROW EXECUTE FUNCTION public.sync_corporate_last_quote();


--
-- Name: corporate_lead_documents corporate_lead_documents_corporate_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_documents
    ADD CONSTRAINT corporate_lead_documents_corporate_lead_id_fkey FOREIGN KEY (corporate_lead_id) REFERENCES public.corporate_leads(corporate_lead_id) ON DELETE CASCADE;


--
-- Name: corporate_lead_items corporate_lead_items_corporate_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_items
    ADD CONSTRAINT corporate_lead_items_corporate_lead_id_fkey FOREIGN KEY (corporate_lead_id) REFERENCES public.corporate_leads(corporate_lead_id);


--
-- Name: corporate_lead_quotes corporate_lead_quotes_corporate_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_quotes
    ADD CONSTRAINT corporate_lead_quotes_corporate_lead_id_fkey FOREIGN KEY (corporate_lead_id) REFERENCES public.corporate_leads(corporate_lead_id) ON DELETE CASCADE;


--
-- Name: corporate_lead_reminders corporate_lead_reminders_corporate_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_reminders
    ADD CONSTRAINT corporate_lead_reminders_corporate_lead_id_fkey FOREIGN KEY (corporate_lead_id) REFERENCES public.corporate_leads(corporate_lead_id);


--
-- Name: corporate_lead_status_history corporate_lead_status_history_corporate_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_lead_status_history
    ADD CONSTRAINT corporate_lead_status_history_corporate_lead_id_fkey FOREIGN KEY (corporate_lead_id) REFERENCES public.corporate_leads(corporate_lead_id) ON DELETE CASCADE;


--
-- Name: corporate_leads corporate_leads_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.corporate_leads
    ADD CONSTRAINT corporate_leads_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(employee_id);


--
-- Name: employees employees_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id);


--
-- Name: lead_items lead_items_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_items
    ADD CONSTRAINT lead_items_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id);


--
-- Name: lead_status_history lead_status_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id);


--
-- Name: lead_status_history lead_status_history_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(employee_id);


--
-- Name: lead_transfers lead_transfers_from_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_transfers
    ADD CONSTRAINT lead_transfers_from_employee_id_fkey FOREIGN KEY (from_employee_id) REFERENCES public.employees(employee_id);


--
-- Name: lead_transfers lead_transfers_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_transfers
    ADD CONSTRAINT lead_transfers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id);


--
-- Name: lead_transfers lead_transfers_to_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.lead_transfers
    ADD CONSTRAINT lead_transfers_to_employee_id_fkey FOREIGN KEY (to_employee_id) REFERENCES public.employees(employee_id);


--
-- Name: leads leads_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.employees(employee_id);


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(employee_id);


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(employee_id);


--
-- Name: leads leads_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(store_id);


--
-- Name: retail_lead_reminders retail_lead_reminders_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crm_user
--

ALTER TABLE ONLY public.retail_lead_reminders
    ADD CONSTRAINT retail_lead_reminders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(lead_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

