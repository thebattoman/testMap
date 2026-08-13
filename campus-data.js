    const BOUNDING_BOX = [
      [101.733366, 2.972174], 
      [101.737937, 2.979556]  
    ];

    const START_COORDINATE = [101.7364682, 2.9763841];

    const TELEPORT_COORDINATES = {
      q: [101.734520, 2.976259],
      w: [101.734702, 2.975551],
      e: [101.737221, 2.977137],
      r: [101.737277, 2.975195]
    };

    // --- BUILDINGS 3D MODEL GEOJSON (REAL OSM FOOTPRINTS) ---
    const BUILDINGS_3D_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_a",
            "height": 18,
            "color": "#e11d48"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7350024,
                  2.9761515
                ],
                [
                  101.7357212,
                  2.976347
                ],
                [
                  101.7357742,
                  2.9761528
                ],
                [
                  101.7350554,
                  2.9759572
                ],
                [
                  101.7350024,
                  2.9761515
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_b",
            "height": 18,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7349679,
                  2.9758468
                ],
                [
                  101.7356867,
                  2.9760423
                ],
                [
                  101.7357397,
                  2.9758481
                ],
                [
                  101.7350208,
                  2.9756526
                ],
                [
                  101.7349679,
                  2.9758468
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_c",
            "height": 20,
            "color": "#2563eb"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7349544,
                  2.9755656
                ],
                [
                  101.7356733,
                  2.9757611
                ],
                [
                  101.7357263,
                  2.9755668
                ],
                [
                  101.7350074,
                  2.9753713
                ],
                [
                  101.7349544,
                  2.9755656
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_d",
            "height": 16,
            "color": "#e11d48"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7362278,
                  2.9762663
                ],
                [
                  101.7362604,
                  2.9761485
                ],
                [
                  101.7360424,
                  2.9760883
                ],
                [
                  101.7361101,
                  2.9758435
                ],
                [
                  101.7363282,
                  2.9759037
                ],
                [
                  101.7363644,
                  2.9757729
                ],
                [
                  101.7360321,
                  2.9756811
                ],
                [
                  101.7358955,
                  2.9761746
                ],
                [
                  101.7362278,
                  2.9762663
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "ldc",
            "height": 22,
            "color": "#e11d48"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7369749,
                  2.9774543
                ],
                [
                  101.7369617,
                  2.9775083
                ],
                [
                  101.7368406,
                  2.9774789
                ],
                [
                  101.7368169,
                  2.9775761
                ],
                [
                  101.7369154,
                  2.9776
                ],
                [
                  101.7369025,
                  2.9776532
                ],
                [
                  101.7369296,
                  2.9776598
                ],
                [
                  101.7369134,
                  2.9777264
                ],
                [
                  101.7371066,
                  2.9777733
                ],
                [
                  101.7371234,
                  2.9777044
                ],
                [
                  101.7372427,
                  2.9777334
                ],
                [
                  101.737292,
                  2.9775313
                ],
                [
                  101.7372196,
                  2.9775137
                ],
                [
                  101.7372472,
                  2.9774003
                ],
                [
                  101.7371669,
                  2.9773808
                ],
                [
                  101.7371499,
                  2.9774507
                ],
                [
                  101.7370886,
                  2.9774358
                ],
                [
                  101.737078,
                  2.9774793
                ],
                [
                  101.7369749,
                  2.9774543
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "dewan_makan",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7362278,
                  2.9762663
                ],
                [
                  101.7366631,
                  2.9763865
                ],
                [
                  101.7366982,
                  2.9762599
                ],
                [
                  101.7368095,
                  2.9762906
                ],
                [
                  101.7368768,
                  2.9760473
                ],
                [
                  101.7367655,
                  2.9760166
                ],
                [
                  101.7367998,
                  2.9758931
                ],
                [
                  101.7363644,
                  2.9757729
                ],
                [
                  101.7363282,
                  2.9759037
                ],
                [
                  101.7362604,
                  2.9761485
                ],
                [
                  101.7362278,
                  2.9762663
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "auditorium",
            "height": 14,
            "color": "#e11d48"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7355078,
                  2.9768468
                ],
                [
                  101.735633,
                  2.9763599
                ],
                [
                  101.7354787,
                  2.9763175
                ],
                [
                  101.7354365,
                  2.9764761
                ],
                [
                  101.7353551,
                  2.9764126
                ],
                [
                  101.7353082,
                  2.9764488
                ],
                [
                  101.7352673,
                  2.9764876
                ],
                [
                  101.7352552,
                  2.9765271
                ],
                [
                  101.7352512,
                  2.976566
                ],
                [
                  101.7352659,
                  2.9766222
                ],
                [
                  101.7352793,
                  2.9766738
                ],
                [
                  101.7353903,
                  2.9766498
                ],
                [
                  101.7353487,
                  2.9768063
                ],
                [
                  101.7355078,
                  2.9768468
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "cafe_zamrud",
            "height": 8,
            "color": "#2563eb"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7358379,
                  2.9772752
                ],
                [
                  101.7361313,
                  2.9773532
                ],
                [
                  101.7361749,
                  2.9771896
                ],
                [
                  101.7358815,
                  2.9771115
                ],
                [
                  101.7358379,
                  2.9772752
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "one_stop_center",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7355078,
                  2.9768468
                ],
                [
                  101.735908,
                  2.9769495
                ],
                [
                  101.7360332,
                  2.9764625
                ],
                [
                  101.735633,
                  2.9763599
                ],
                [
                  101.7355078,
                  2.9768468
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "pejabat_pengurusan",
            "height": 14,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.735908,
                  2.9769495
                ],
                [
                  101.736218,
                  2.977029
                ],
                [
                  101.7363432,
                  2.9765421
                ],
                [
                  101.7360332,
                  2.9764625
                ],
                [
                  101.735908,
                  2.9769495
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "irc",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7362278,
                  2.9762663
                ],
                [
                  101.73619,
                  2.9764029
                ],
                [
                  101.7366253,
                  2.9765231
                ],
                [
                  101.7366631,
                  2.9763865
                ],
                [
                  101.7362278,
                  2.9762663
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_e",
            "height": 16,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7351741,
                  2.9750104
                ],
                [
                  101.7361852,
                  2.9752809
                ],
                [
                  101.7362512,
                  2.9750352
                ],
                [
                  101.73524,
                  2.9747647
                ],
                [
                  101.7351741,
                  2.9750104
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "block_f",
            "height": 14,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7347744,
                  2.9744747
                ],
                [
                  101.7360544,
                  2.9748171
                ],
                [
                  101.7361182,
                  2.9745791
                ],
                [
                  101.7360403,
                  2.9745583
                ],
                [
                  101.7360728,
                  2.9744373
                ],
                [
                  101.7359137,
                  2.9743947
                ],
                [
                  101.7358812,
                  2.9745157
                ],
                [
                  101.7358309,
                  2.9745023
                ],
                [
                  101.7358633,
                  2.9743813
                ],
                [
                  101.7356909,
                  2.9743352
                ],
                [
                  101.7356585,
                  2.9744562
                ],
                [
                  101.7348382,
                  2.9742367
                ],
                [
                  101.7347744,
                  2.9744747
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "anggerik",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7365428,
                  2.9770639
                ],
                [
                  101.7369719,
                  2.9771782
                ],
                [
                  101.7371277,
                  2.9765954
                ],
                [
                  101.7367764,
                  2.9765018
                ],
                [
                  101.7366986,
                  2.9764811
                ],
                [
                  101.7365428,
                  2.9770639
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "melur",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7371502,
                  2.9763848
                ],
                [
                  101.7368095,
                  2.9762906
                ],
                [
                  101.7366982,
                  2.9762599
                ],
                [
                  101.7366631,
                  2.9763865
                ],
                [
                  101.7371152,
                  2.9765113
                ],
                [
                  101.7371502,
                  2.9763848
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "cempaka",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7365259,
                  2.9752709
                ],
                [
                  101.7368573,
                  2.9753559
                ],
                [
                  101.7369438,
                  2.9750198
                ],
                [
                  101.7366124,
                  2.9749347
                ],
                [
                  101.7365259,
                  2.9752709
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "balai_islam",
            "height": 10,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7351995,
                  2.9736015
                ],
                [
                  101.7353136,
                  2.9735723
                ],
                [
                  101.7353469,
                  2.9737021
                ],
                [
                  101.7354067,
                  2.9736868
                ],
                [
                  101.7353735,
                  2.973557
                ],
                [
                  101.7354825,
                  2.9735291
                ],
                [
                  101.7354411,
                  2.9733675
                ],
                [
                  101.7351581,
                  2.9734398
                ],
                [
                  101.7351995,
                  2.9736015
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "mawar",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7363706,
                  2.9746002
                ],
                [
                  101.736702,
                  2.9746853
                ],
                [
                  101.7367885,
                  2.9743491
                ],
                [
                  101.7364571,
                  2.9742641
                ],
                [
                  101.7363706,
                  2.9746002
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "seroja",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7370465,
                  2.9747824
                ],
                [
                  101.7373779,
                  2.9748674
                ],
                [
                  101.7374644,
                  2.9745313
                ],
                [
                  101.737133,
                  2.9744462
                ],
                [
                  101.7370465,
                  2.9747824
                ]
              ]
            ]
          }
        },
        {
          "type": "Feature",
          "properties": {
            "blockKey": "dahlia",
            "height": 12,
            "color": "#1e3a8a"
          },
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  101.7368239,
                  2.974169
                ],
                [
                  101.7371553,
                  2.974254
                ],
                [
                  101.7372418,
                  2.9739179
                ],
                [
                  101.7369104,
                  2.9738328
                ],
                [
                  101.7368239,
                  2.974169
                ]
              ]
            ]
          }
        }
      ]
    };


    // --- EMBEDDED ROUTE GEOJSON DATA SOURCES ---
    const ROUTE_LDC_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [101.7364682, 2.9763841],
              [101.7371933, 2.9765872],
              [101.7370537, 2.9772802],
              [101.7372255, 2.9773462],
              [101.73721, 2.9773967]
            ]
          }
        }
      ]
    };

    const ROUTE_BLOCK_D_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [101.7364682, 2.9763841],
              [101.7358639, 2.9762219],
              [101.735898, 2.9760764],
              [101.7359662, 2.9761104]
            ]
          }
        }
      ]
    };

    const ROUTE_BLOCK_C_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [101.7364682, 2.9763841],
              [101.7358635, 2.9762251],
              [101.7359508, 2.9758734],
              [101.7356111, 2.9757886],
              [101.7356256, 2.975714]
            ]
          }
        }
      ]
    };

    const ROUTE_BLOCK_B_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [101.7364682, 2.9763841],
              [101.7358646, 2.9762229],
              [101.7358778, 2.9761752],
              [101.7357623, 2.9761357],
              [101.7357805, 2.9760632],
              [101.735642, 2.9760121]
            ]
          }
        }
      ]
    };

    const ROUTE_BLOCK_A_GEOJSON = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "LineString",
            "coordinates": [
              [101.7364682, 2.9763841],
              [101.7358696, 2.9762236],
              [101.7358271, 2.9763907],
              [101.7355625, 2.9762996]
            ]
          }
        }
      ]
    };

    const BLOCKS = {
      block_a: { 
        name: 'Block A', 
        coords: [101.735391, 2.976143], 
        color: '#e11d48',
        entries: [
          [101.735724, 2.976320],
          [101.735013, 2.976135]
        ],
        route: ROUTE_BLOCK_A_GEOJSON,
        images: [
          { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', caption: 'Main Entrance' },
          { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', caption: 'Lobby' },
          { url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80', caption: 'Courtyard' }
        ]
      },
      block_b: { 
        name: 'Block B', 
        coords: [101.735354, 2.975841], 
        color: '#1e3a8a',
        entries: [
          [101.735681, 2.976012],
          [101.734997, 2.975817]
        ],
        route: ROUTE_BLOCK_B_GEOJSON,
        images: [
          { url: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1200&q=80', caption: 'Faculty Wing' },
          { url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80', caption: 'Lecture Room' }
        ]
      },
      block_c: { 
        name: 'Block C', 
        coords: [101.735346, 2.975565], 
        color: '#2563eb',
        entries: [
          [101.734976, 2.975551],
          [101.735660, 2.975723]
        ],
        route: ROUTE_BLOCK_C_GEOJSON,
        images: [
          { url: 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80', caption: 'Science Lab' },
          { url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80', caption: 'Study Area' }
        ]
      },
      block_d: { 
        name: 'Block D', 
        coords: [101.736545, 2.976093], 
        color: '#e11d48',
        entries: [
          [101.735922, 2.976149],
          [101.736319, 2.976299]
        ],
        route: ROUTE_BLOCK_D_GEOJSON,
        images: [
          { url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80', caption: 'Admin Plaza' }
        ]
      },
      ldc: { 
        name: 'LDC', 
        coords: [101.737089, 2.977553], 
        color: '#e11d48',
        entries: [
          [101.73721, 2.9773967]
        ],
        route: ROUTE_LDC_GEOJSON,
        images: [
          { url: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80', caption: 'LDC Main Entrance' },
          { url: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80', caption: 'LDC Learning Lab' }
        ]
      },
      dewan_makan: {
        name: 'Dewan Makan',
        coords: [101.736413, 2.976076],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: [
          { url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80', caption: 'Dining Hall' },
          { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80', caption: 'Food Stalls' }
        ]
      },
      auditorium: {
        name: 'Auditorium',
        coords: [101.735415, 2.976567],
        color: '#e11d48',
        entries: [],
        route: null,
        images: [
          { url: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80', caption: 'Main Stage' },
          { url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80', caption: 'Seating Area' }
        ]
      },
      cafe_zamrud: {
        name: 'Cafe Zamrud',
        coords: [101.736110, 2.977309],
        color: '#2563eb',
        entries: [],
        route: null,
        images: [
          { url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80', caption: 'Outdoor Patio' },
          { url: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=80', caption: 'Barista Counter' }
        ]
      },
      one_stop_center: {
        name: 'One Stop Center',
        coords: [101.735748, 2.976494],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: [
          { url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', caption: 'Helpdesk Counter' },
          { url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80', caption: 'Student Services' }
        ]
      },
      pejabat_pengurusan: {
        name: 'Pejabat Pengurusan',
        coords: [101.736145, 2.976751],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      irc: {
        name: 'IRC',
        coords: [101.736644, 2.976326],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      block_e: {
        name: 'Block E',
        coords: [101.735724, 2.975028],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      block_f: {
        name: 'Block F',
        coords: [101.735448, 2.974524],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      anggerik: {
        name: 'Anggerik',
        coords: [101.736829, 2.976834],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      melur: {
        name: 'Melur',
        coords: [101.736915, 2.976380],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      cempaka: {
        name: 'Cempaka',
        coords: [101.736730, 2.975151],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      balai_islam: {
        name: 'Balai Islam',
        coords: [101.735316, 2.973488],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      mawar: {
        name: 'Mawar',
        coords: [101.736585, 2.974477],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      seroja: {
        name: 'Seroja',
        coords: [101.737269, 2.974649],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      },
      dahlia: {
        name: 'Dahlia',
        coords: [101.737038, 2.974044],
        color: '#1e3a8a',
        entries: [],
        route: null,
        images: []
      }
    };
