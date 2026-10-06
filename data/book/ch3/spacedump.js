/* tools/ibdspace.js 가 실제 .ibd 에서 뜬 page 0(FSP header · XDES) 과 page 2(inode) — 손으로 고치지 않는다.
   hex 가 원본이고 f 는 그것을 푼 값이다. check.sh 가 hex 를 다시 풀어 f 와 맞춘다. */
export const SPACEDUMP = {
 "meta": {
  "pageSize": 16384,
  "mysqld": "8.4.8-debug",
  "rowFormat": "dynamic",
  "fastShutdown": 0,
  "small": {
   "note": "06b 와 같은 t.ibd — INSERT 1,000 · DELETE 11 · UPDATE 1",
   "rows": 989,
   "index": {
    "154": {
     "name": "PRIMARY",
     "root": 4
    },
    "155": {
     "name": "idx_c",
     "root": 5
    }
   }
  },
  "big": {
   "note": "따로 돌린 실측 — 같은 표에 10,000 행을 순차로 넣었다",
   "rows": 10000,
   "sql": [
    "CREATE TABLE d.big (id INT AUTO_INCREMENT PRIMARY KEY, c INT NOT NULL, pad CHAR(100) NOT NULL, KEY idx_c (c)) ROW_FORMAT=DYNAMIC",
    "INSERT 10,000 행 — id 순차, c = (n × 7) % 10000",
    "SHUTDOWN — innodb_fast_shutdown = 0"
   ],
   "index": {
    "154": {
     "name": "PRIMARY",
     "root": 4
    },
    "155": {
     "name": "idx_c",
     "root": 5
    }
   },
   "fileSize": 9437184,
   "allocated": 9437184
  }
 },
 "files": {
  "small": {
   "file": "t.ibd",
   "nPages": 17,
   "p0": {
    "hex": "afc7f53c0000000000013a1800000001000000000129c47b000800000000000000000000000200000002000000000000001100000040000040210000000f00000000ffffffff0000ffffffff00000000000100000000009e00000000009e00000000ffffffff0000ffffffff0000000000000000000700000000ffffffff0000ffffffff0000000000010000000200260000000200260000000000000000ffffffff0000ffffffff000000000002aaaaaaeaffffffffffffffffffffffff",
    "f": {
     "FSP_SPACE_ID": 2,
     "FSP_NOT_USED": 0,
     "FSP_SIZE": 17,
     "FSP_FREE_LIMIT": 64,
     "FSP_SPACE_FLAGS": 16417,
     "FSP_FRAG_N_USED": 15,
     "FSP_SEG_ID": 7,
     "FSP_FREE": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_FREE_FRAG": {
      "len": 1,
      "first": {
       "page": 0,
       "byte": 158
      },
      "last": {
       "page": 0,
       "byte": 158
      }
     },
     "FSP_FULL_FRAG": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_SEG_INODES_FULL": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_SEG_INODES_FREE": {
      "len": 1,
      "first": {
       "page": 2,
       "byte": 38
      },
      "last": {
       "page": 2,
       "byte": 38
      }
     },
     "xdes": [
      {
       "at": 150,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_FREE_FRAG",
       "used": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14
       ]
      }
     ]
    }
   },
   "p2": {
    "hex": "bd1454d90000000200000000000000000000000001288c820003000000000000000000000002ffffffff0000ffffffff000000000000000000010000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000003ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000020000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000030000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000004ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000040000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d2000000060000000700000008000000090000000a0000000b0000000c0000000d0000000effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000050000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000005ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000060000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "f": [
     {
      "at": 50,
      "FSEG_ID": 1,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       3
      ]
     },
     {
      "at": 242,
      "FSEG_ID": 2,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": []
     },
     {
      "at": 434,
      "FSEG_ID": 3,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       4
      ]
     },
     {
      "at": 626,
      "FSEG_ID": 4,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       6,
       7,
       8,
       9,
       10,
       11,
       12,
       13,
       14
      ]
     },
     {
      "at": 818,
      "FSEG_ID": 5,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       5
      ]
     },
     {
      "at": 1010,
      "FSEG_ID": 6,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": []
     }
    ]
   },
   "roots": {
    "4": {
     "hex": "a65c7dc300000004ffffffffffffffff000000000129c47b45bf000000000000000000000002000300ed800b0000000000e500020008000900000000000000000001000000000000009a00000002000000020272000000020000000201b2",
     "f": {
      "FIL_PAGE_OFFSET": 4,
      "PAGE_N_RECS": 9,
      "PAGE_LEVEL": 1,
      "PAGE_INDEX_ID": 154
     }
    },
    "5": {
     "hex": "cbd4cbc100000005ffffffffffffffff000000000129c50545bf0000000000000000000000020093334d83eb19d4009c00000005000003dd00000000000005180000000000000000009b000000020000000203f200000002000000020332",
     "f": {
      "FIL_PAGE_OFFSET": 5,
      "PAGE_N_RECS": 989,
      "PAGE_LEVEL": 0,
      "PAGE_INDEX_ID": 155
     }
    }
   }
  },
  "big": {
   "file": "big.ibd",
   "nPages": 576,
   "p0": {
    "hex": "a9fb6b890000000000013a1800000001000000000144d640000800000000000000000000000200000002000000000000024000000080000040210000003000000000ffffffff0000ffffffff00000000000100000000009e00000000009e00000000ffffffff0000ffffffff0000000000000000000700000000ffffffff0000ffffffff0000000000010000000200260000000200260000000000000000ffffffff0000ffffffff000000000002aaaaaaaaaaaaaaaaaaaaaaaaffffffff0000000000000004ffffffff0000ffffffff000000000004aaaaaaaaaaaaaaaaaaaaaaaaaafeffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "f": {
     "FSP_SPACE_ID": 2,
     "FSP_NOT_USED": 0,
     "FSP_SIZE": 576,
     "FSP_FREE_LIMIT": 128,
     "FSP_SPACE_FLAGS": 16417,
     "FSP_FRAG_N_USED": 48,
     "FSP_SEG_ID": 7,
     "FSP_FREE": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_FREE_FRAG": {
      "len": 1,
      "first": {
       "page": 0,
       "byte": 158
      },
      "last": {
       "page": 0,
       "byte": 158
      }
     },
     "FSP_FULL_FRAG": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_SEG_INODES_FULL": {
      "len": 0,
      "first": null,
      "last": null
     },
     "FSP_SEG_INODES_FREE": {
      "len": 1,
      "first": {
       "page": 2,
       "byte": 38
      },
      "last": {
       "page": 2,
       "byte": 38
      }
     },
     "xdes": [
      {
       "at": 150,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_FREE_FRAG",
       "used": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47
       ]
      },
      {
       "at": 190,
       "XDES_ID": 4,
       "XDES_STATE": "XDES_FSEG",
       "used": [
        64,
        65,
        66,
        67,
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        82,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,
        91,
        92,
        93,
        94,
        95,
        96,
        97,
        98,
        99,
        100,
        101,
        102,
        103,
        104,
        105,
        106,
        107,
        108,
        109,
        110,
        111,
        112,
        113,
        114,
        115,
        116
       ]
      },
      {
       "at": 230,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 270,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 310,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 350,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 390,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 430,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      },
      {
       "at": 470,
       "XDES_ID": 0,
       "XDES_STATE": "XDES_NOT_INITED",
       "used": []
      }
     ]
    }
   },
   "p2": {
    "hex": "c0653b92000000020000000000000000000000000144d6400003000000000000000000000002ffffffff0000ffffffff000000000000000000010000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000003ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000020000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000030000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000004ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000040000003500000000ffffffff0000ffffffff0000000000010000000000c60000000000c600000000ffffffff0000ffffffff000005d669d2000000060000000700000008000000090000000a0000000b0000000c0000000d0000000e0000000f00000010000000130000001400000015000000160000001700000018000000190000001b0000001c0000001d0000001f0000002000000021000000220000002300000024000000250000002600000027000000280000002900000000000000050000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000005ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000060000000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000000000000ffffffff0000ffffffff000005d669d200000011000000120000001a0000001e0000002a0000002b0000002c0000002d0000002e0000002fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "f": [
     {
      "at": 50,
      "FSEG_ID": 1,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       3
      ]
     },
     {
      "at": 242,
      "FSEG_ID": 2,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": []
     },
     {
      "at": 434,
      "FSEG_ID": 3,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       4
      ]
     },
     {
      "at": 626,
      "FSEG_ID": 4,
      "FSEG_NOT_FULL_N_USED": 53,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 1,
       "first": {
        "page": 0,
        "byte": 198
       },
       "last": {
        "page": 0,
        "byte": 198
       }
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       6,
       7,
       8,
       9,
       10,
       11,
       12,
       13,
       14,
       15,
       16,
       19,
       20,
       21,
       22,
       23,
       24,
       25,
       27,
       28,
       29,
       31,
       32,
       33,
       34,
       35,
       36,
       37,
       38,
       39,
       40,
       41
      ]
     },
     {
      "at": 818,
      "FSEG_ID": 5,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       5
      ]
     },
     {
      "at": 1010,
      "FSEG_ID": 6,
      "FSEG_NOT_FULL_N_USED": 0,
      "FSEG_FREE": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_NOT_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_FULL": {
       "len": 0,
       "first": null,
       "last": null
      },
      "FSEG_MAGIC_N": 97937874,
      "frag": [
       17,
       18,
       26,
       30,
       42,
       43,
       44,
       45,
       46,
       47
      ]
     }
    ]
   },
   "roots": {
    "4": {
     "hex": "76dcd46a00000004ffffffffffffffff000000000144d64045bf000000000000000000000002001604c980570000000004c100020054005500000000000000000001000000000000009a00000002000000020272000000020000000201b2",
     "f": {
      "FIL_PAGE_OFFSET": 4,
      "PAGE_N_RECS": 85,
      "PAGE_LEVEL": 1,
      "PAGE_INDEX_ID": 154
     }
    },
    "5": {
     "hex": "5fb4ad2400000005ffffffffffffffff00000000013f59fa45bf00000000000000000000000200030122800c00000000011600050000000a00000000000000000001000000000000009b000000020000000203f200000002000000020332",
     "f": {
      "FIL_PAGE_OFFSET": 5,
      "PAGE_N_RECS": 10,
      "PAGE_LEVEL": 1,
      "PAGE_INDEX_ID": 155
     }
    }
   }
  }
 }
};
