# api/rates.py
# Static rates database for UK residential construction, Q1 2025 – Q2 2026.
# Sources: BCIS Price Book 2025, Spon's Architects' & Builders' Price Book 2025,
# Laxton's Building Price Book 2025, regional SME builder quotations.
#
# material_rate : cost of materials per unit, £
# labour_rate   : all-in labour cost per unit, £ (gang rate incl. NI, tools, plant)
# unit          : m (linear), m² (area), m³ (volume), nr (number / item)
#
# Key naming convention: <trade>_<brief_spec>  e.g. 'blockwork_100mm'
# Rates are UK national averages; London / SE uplift typically +15–25 %.

RATES_DB = {

    # ── GROUNDWORKS (6 items) ────────────────────────────────────────────────────────

    "excavation_reduced_level": {
        # Machine excavation to reduce site to formation level, spoil aside / away
        "material_rate": 0.00,   # no material — labour + plant only
        "labour_rate":   8.50,   # 360° excavator gang, includes disposal to 500 m
        "unit": "m²",
    },

    "excavation_trench": {
        # Machine trench excavation for strip or pad foundations, depth ≤ 1.5 m
        "material_rate": 0.00,
        "labour_rate":   22.00,  # includes trimming by hand and earthwork support
        "unit": "m³",
    },

    "concrete_strip_foundation": {
        # Mass concrete C25/30, placed in trench, including poker vibration
        "material_rate": 95.00,  # ready-mix delivered + pump; C25/30 ≈ £90/m³ ex-pump
        "labour_rate":   48.00,  # pour, level and cure; formwork not required for strip
        "unit": "m³",
    },

    "hardcore_filling_150mm": {
        # Granular fill (Type 1 MOT), compacted in 75 mm layers to 150 mm total depth
        "material_rate": 7.50,   # Type 1 delivered and spread
        "labour_rate":   4.00,   # plate-compaction gang
        "unit": "m²",
    },

    "concrete_slab_150mm": {
        # Ground-bearing slab, C25/30, 150 mm thick, mesh reinforcement A193, DPM below
        "material_rate": 22.00,  # concrete + A193 mesh + DPM
        "labour_rate":   14.00,  # pour, screed, power-float finish
        "unit": "m²",
    },

    "drainage_clay_100mm": {
        # Vitrified clay pipe (Hepworth Supersleeve or equiv.), 100 mm dia, bed & haunch in concrete
        "material_rate": 12.00,  # pipe, couplings, bed concrete
        "labour_rate":   18.00,  # lay, joint, test; excludes excavation (see trench above)
        "unit": "m",
    },

    # ── BRICKWORK (5 items) ──────────────────────────────────────────────────────────

    "brickwork_half_brick_skin": {
        # 102 mm facing brick, stretcher bond, PC £350/1000, mortar, joints struck flush
        "material_rate": 28.00,  # bricks + mortar (allow ~60 bricks/m² + wastage)
        "labour_rate":   38.00,  # bricklayer + labourer gang rate
        "unit": "m²",
    },

    "brickwork_one_brick_wall": {
        # 215 mm solid brick wall, English or Flemish bond, PC £350/1000
        "material_rate": 56.00,  # ~120 bricks/m² + mortar
        "labour_rate":   76.00,  # slower laying rate for solid wall
        "unit": "m²",
    },

    "engineering_brick_dpc": {
        # Two courses Class B engineering brick DPC, bed in 1:3 sulphate-resistant mortar
        "material_rate": 18.00,  # engineering bricks at ~£600/1000
        "labour_rate":   22.00,  # careful bedding and jointing required
        "unit": "m",
    },

    "facing_brick_feature_panel": {
        # Feature panel / patterned brickwork, PC £550/1000 brick, decorative bond
        "material_rate": 65.00,  # premium facing brick + coloured mortar
        "labour_rate":   62.00,  # skilled bricklayer; complex setting out
        "unit": "m²",
    },

    "cavity_wall_tie": {
        # Stainless steel wall tie (Ancon or equiv.) at 900×450 mm spacing
        "material_rate": 0.45,   # per tie including resin anchor if required
        "labour_rate":   0.55,   # drill, insert, check alignment
        "unit": "nr",
    },

    # ── BLOCKWORK (4 items) ──────────────────────────────────────────────────────────

    "blockwork_100mm": {
        # 100 mm dense aggregate concrete block, 7.3 N/mm², mortar bed and perpends
        "material_rate": 12.00,  # blocks ~£1.80 each, ~10 blocks/m²
        "labour_rate":   22.00,  # bricklayer + labourer
        "unit": "m²",
    },

    "blockwork_140mm": {
        # 140 mm dense aggregate block — commonly used for single-leaf party walls
        "material_rate": 16.00,
        "labour_rate":   25.00,
        "unit": "m²",
    },

    "blockwork_215mm": {
        # 215 mm dense aggregate block, used for structural walls, 7.3 N/mm²
        "material_rate": 22.00,
        "labour_rate":   30.00,
        "unit": "m²",
    },

    "aerated_blockwork_100mm": {
        # 100 mm Thermalite / Celcon aircrete block, 3.6 N/mm², thermal inner leaf
        "material_rate": 10.00,  # aircrete blocks ~£1.40 each
        "labour_rate":   20.00,  # lighter blocks, faster to lay
        "unit": "m²",
    },

    # ── CARPENTRY / TIMBER FRAME (8 items) ──────────────────────────────────────────

    "stud_partition_100mm": {
        # 100 mm metal stud or 75 × 50 C16 timber stud, single-layer 12.5 mm plasterboard each side
        "material_rate": 18.00,  # studs, track/sole plate, plasterboard, fixings
        "labour_rate":   22.00,  # frame erect + board (1 side only; skim extra)
        "unit": "m²",
    },

    "floor_joist_47x195mm": {
        # 47 × 195 mm C24 regularised timber floor joist, joist hanger or bearing on wall plate
        "material_rate": 8.50,   # C24 regularised timber at ~£3.20/m + hangers
        "labour_rate":   6.00,   # fix, strut and noggin
        "unit": "m",
    },

    "roof_rafter_47x150mm": {
        # 47 × 150 mm C24 common rafter, birdsmouth cut, fixed to ridge and wall plate
        "material_rate": 6.50,
        "labour_rate":   5.50,
        "unit": "m",
    },

    "timber_wall_plate_100x75": {
        # 100 × 75 mm C24 wall plate bedded in mortar on top of masonry, coach-bolt fixed
        "material_rate": 4.80,
        "labour_rate":   4.50,
        "unit": "m",
    },

    "staircase_softwood_straight": {
        # Softwood straight staircase, 13 risers, balustrading, newel post, handrail
        "material_rate": 900.00,  # purpose-made staircase unit
        "labour_rate":   350.00,  # fix in place, cut strings to pitch
        "unit": "nr",
    },

    "door_lining_set_softwood": {
        # Softwood door lining set to suit 838 mm leaf, rebated, including fixings
        "material_rate": 45.00,
        "labour_rate":   35.00,
        "unit": "nr",
    },

    "skirting_board_mdf_100mm": {
        # 19 × 100 mm MDF ogee skirting, pinned and glued, joints scribed
        "material_rate": 4.20,
        "labour_rate":   5.00,
        "unit": "m",
    },

    "architrave_mdf_set": {
        # 19 × 69 mm MDF ovolo architrave, door set (2 sides), mitred and pinned
        "material_rate": 3.50,
        "labour_rate":   4.20,
        "unit": "m",
    },

    # ── ROOFING (6 items) ────────────────────────────────────────────────────────────

    "concrete_interlocking_tile": {
        # Marley Ludlow Plus or equiv., nailed at min. every 4th course, on battens
        "material_rate": 22.00,  # tiles, battens, fixings; ~14 tiles/m²
        "labour_rate":   18.00,
        "unit": "m²",
    },

    "clay_plain_tile": {
        # Hand-made or machine-made clay plain tile, 265 × 165 mm, double-lap, nailed
        "material_rate": 38.00,  # ~60 tiles/m² incl. 10 % wastage
        "labour_rate":   25.00,
        "unit": "m²",
    },

    "natural_slate": {
        # Welsh or Westmorland natural slate, 500 × 300 mm, double-lap, copper nails
        "material_rate": 65.00,  # slate + copper nails + battens
        "labour_rate":   35.00,  # skilled slater
        "unit": "m²",
    },

    "roofing_felt_underlay": {
        # Klober Permo air or equiv. breathable roofing membrane, lapped 150 mm
        "material_rate": 3.50,
        "labour_rate":   2.00,
        "unit": "m²",
    },

    "lead_flashing_code4": {
        # Code 4 milled lead (1.80 mm) step / cover flashing, dressed and wedged
        "material_rate": 28.00,  # lead at ~£3.50/kg; code 4 ≈ 20 kg/m²
        "labour_rate":   22.00,  # skilled plumber / roofer
        "unit": "m",
    },

    "upvc_fascia_soffit": {
        # UPVC 250 mm fascia + 400 mm soffit board, white, including vented sections
        "material_rate": 18.00,
        "labour_rate":   12.00,
        "unit": "m",
    },

    # ── PLASTERING (4 items) ─────────────────────────────────────────────────────────

    "plaster_float_set_2coat": {
        # Carlite browning undercoat + Carlite finish, 13 mm total, to masonry
        "material_rate": 4.50,
        "labour_rate":   12.00,  # plasterer + labourer; ~2 m²/hr
        "unit": "m²",
    },

    "plasterboard_12_5mm": {
        # 12.5 mm Gyproc WallBoard, screwed to timber frame, joints taped and filled
        "material_rate": 6.50,   # board, screws, tape, joint compound
        "labour_rate":   8.50,
        "unit": "m²",
    },

    "skim_coat_plasterboard": {
        # 2–3 mm Thistle MultiFinish skim coat to plasterboard, steel-trowel finish
        "material_rate": 1.50,
        "labour_rate":   6.00,
        "unit": "m²",
    },

    "external_render_2coat": {
        # Sand-cement scratch coat + tyrolean / smooth finish coat, pebble-dash option
        "material_rate": 8.00,   # bagged render + beads + fixings
        "labour_rate":   18.00,  # scratch coat, dry, finish coat; includes angle beads
        "unit": "m²",
    },

    # ── PAINTING & DECORATING (4 items) ─────────────────────────────────────────────

    "emulsion_paint_2coat_walls": {
        # Dulux / Johnstone's matt emulsion, mist coat + 2 finish coats to plaster
        "material_rate": 1.80,   # ~6 m² per litre at 2 coats; trade 5-litre tub
        "labour_rate":   4.50,
        "unit": "m²",
    },

    "emulsion_paint_2coat_ceiling": {
        # As above, ceiling rate slightly higher due to working overhead
        "material_rate": 1.80,
        "labour_rate":   5.50,
        "unit": "m²",
    },

    "gloss_paint_woodwork": {
        # Dulux Trade gloss, undercoat + 2 top coats, brush applied to timber
        "material_rate": 0.80,   # per linear metre of skirting / architrave / door frame
        "labour_rate":   3.50,
        "unit": "m",
    },

    "masonry_paint_external": {
        # Sandtex Smooth or Dulux Weathershield, stabilising primer + 2 finish coats
        "material_rate": 3.50,
        "labour_rate":   6.00,   # includes scaffold allowance in labour rate
        "unit": "m²",
    },

    # ── WINDOWS & DOORS (6 items) ────────────────────────────────────────────────────

    "upvc_window_1200x1050": {
        # White UPVC casement window 1200 × 1050 mm, A-rated, trickle vent, cill included
        "material_rate": 280.00,
        "labour_rate":   85.00,  # fix, seal, make good reveals
        "unit": "nr",
    },

    "upvc_window_600x900": {
        # White UPVC casement window 600 × 900 mm, A-rated, trickle vent
        "material_rate": 180.00,
        "labour_rate":   75.00,
        "unit": "nr",
    },

    "upvc_composite_front_door": {
        # Composite (GRP skin / timber core) front door set 920 × 2100 mm, multi-point lock
        "material_rate": 650.00,  # door, frame, cill, letterbox, lever handle
        "labour_rate":   120.00,
        "unit": "nr",
    },

    "upvc_back_door": {
        # White UPVC back door 840 × 2100 mm, half-glazed, 3-point lock
        "material_rate": 440.00,
        "labour_rate":   95.00,
        "unit": "nr",
    },

    "softwood_internal_door": {
        # Softwood flush or panelled internal door 838 × 1981 mm, PC £85, inc. ironmongery
        "material_rate": 85.00,  # door leaf + lever latch + hinges (3 no.)
        "labour_rate":   55.00,  # hang, adjust, fit furniture
        "unit": "nr",
    },

    "fire_door_fd30": {
        # FD30 fire-check door 838 × 1981 mm, intumescent strip, closer, CE-marked
        "material_rate": 180.00,  # FD30 leaf + ironmongery + intumescent strip
        "labour_rate":   65.00,   # hang, adjust, fit closer, check gaps ≤ 3 mm
        "unit": "nr",
    },
}
