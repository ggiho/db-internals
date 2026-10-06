/* tools/ibdpage.js 가 실제 .ibd 에서 뜬 B-tree 페이지(INDEX · SDI)의 앞 94바이트 — 손으로 고치지 않는다.
   hex 가 원본이고 f 는 그것을 푼 값이다. check.sh 가 hex 를 다시 풀어 f 와 맞춘다. */
export const PAGEDUMP = {
 "meta": {
  "file": "t.ibd",
  "pageSize": 16384,
  "nPages": 17,
  "mysqld": "8.4.8-debug",
  "rowFormat": "dynamic",
  "fastShutdown": 0,
  "space": 2,
  "rows": 989,
  "sql": [
   "CREATE TABLE d.t (id INT AUTO_INCREMENT PRIMARY KEY, c INT NOT NULL, pad CHAR(100) NOT NULL, KEY idx_c (c)) ROW_FORMAT=DYNAMIC",
   "INSERT 1,000 행 한 트랜잭션 — id 순차, c = (n × 7) % 1000",
   "DELETE FROM d.t WHERE id BETWEEN 10 AND 20 — 11 행",
   "UPDATE d.t SET c = c + 1000 WHERE id = 500",
   "SHUTDOWN — innodb_fast_shutdown = 0 이라 purge 를 끝내고 내린다"
  ],
  "trx": {
   "insert": 1299,
   "delete": 1302,
   "update": 1304
  },
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
  "bufpage": {
   "4": {
    "recs": 9,
    "data": 117
   },
   "5": {
    "recs": 989,
    "data": 12857
   },
   "6": {
    "recs": 48,
    "data": 6096
   },
   "7": {
    "recs": 119,
    "data": 15113
   },
   "8": {
    "recs": 119,
    "data": 15113
   },
   "9": {
    "recs": 119,
    "data": 15113
   },
   "10": {
    "recs": 119,
    "data": 15113
   },
   "11": {
    "recs": 119,
    "data": 15113
   },
   "12": {
    "recs": 119,
    "data": 15113
   },
   "13": {
    "recs": 119,
    "data": 15113
   },
   "14": {
    "recs": 108,
    "data": 13716
   }
  }
 },
 "pages": {
  "3": {
   "hex": "c8482ec000000003ffffffffffffffff000000000125858745bd000000000000000000000002000205df800400000000019f00010001000200000000000000000000ffffffffffffffff000000020000000200f200000002000000020032",
   "f": {
    "FIL_PAGE_OFFSET": 3,
    "FIL_PAGE_PREV": 4294967295,
    "FIL_PAGE_NEXT": 4294967295,
    "FIL_PAGE_LSN": 19236231,
    "FIL_PAGE_TYPE": 17853,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 2,
    "PAGE_HEAP_TOP": 1503,
    "PAGE_N_HEAP": 32772,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 415,
    "PAGE_DIRECTION": 1,
    "PAGE_N_DIRECTION": 1,
    "PAGE_N_RECS": 2,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": "18446744073709551615",
    "PAGE_BTR_SEG_LEAF": {
     "space": 2,
     "page": 2,
     "offset": 242
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 2,
     "page": 2,
     "offset": 50
    }
   }
  },
  "4": {
   "hex": "a65c7dc300000004ffffffffffffffff000000000129c47b45bf000000000000000000000002000300ed800b0000000000e500020008000900000000000000000001000000000000009a00000002000000020272000000020000000201b2",
   "f": {
    "FIL_PAGE_OFFSET": 4,
    "FIL_PAGE_PREV": 4294967295,
    "FIL_PAGE_NEXT": 4294967295,
    "FIL_PAGE_LSN": 19514491,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 3,
    "PAGE_HEAP_TOP": 237,
    "PAGE_N_HEAP": 32779,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 229,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 8,
    "PAGE_N_RECS": 9,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 1,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 2,
     "page": 2,
     "offset": 626
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 2,
     "page": 2,
     "offset": 434
    }
   }
  },
  "5": {
   "hex": "cbd4cbc100000005ffffffffffffffff000000000129c50545bf0000000000000000000000020093334d83eb19d4009c00000005000003dd00000000000005180000000000000000009b000000020000000203f200000002000000020332",
   "f": {
    "FIL_PAGE_OFFSET": 5,
    "FIL_PAGE_PREV": 4294967295,
    "FIL_PAGE_NEXT": 4294967295,
    "FIL_PAGE_LSN": 19514629,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 147,
    "PAGE_HEAP_TOP": 13133,
    "PAGE_N_HEAP": 33771,
    "PAGE_FREE": 6612,
    "PAGE_GARBAGE": 156,
    "PAGE_LAST_INSERT": 0,
    "PAGE_DIRECTION": 5,
    "PAGE_N_DIRECTION": 0,
    "PAGE_N_RECS": 989,
    "PAGE_MAX_TRX_ID": 1304,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 155,
    "PAGE_BTR_SEG_LEAF": {
     "space": 2,
     "page": 2,
     "offset": 1010
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 2,
     "page": 2,
     "offset": 818
    }
   }
  },
  "6": {
   "hex": "2520687b00000006ffffffff00000007000000000129c47b45bf000000000000000000000002000d3b81807909eb2339000000050000003000000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 6,
    "FIL_PAGE_PREV": 4294967295,
    "FIL_PAGE_NEXT": 7,
    "FIL_PAGE_LSN": 19514491,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 13,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 2539,
    "PAGE_GARBAGE": 9017,
    "PAGE_LAST_INSERT": 0,
    "PAGE_DIRECTION": 5,
    "PAGE_N_DIRECTION": 0,
    "PAGE_N_RECS": 48,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "7": {
   "hex": "23304afc000000070000000600000008000000000129c47b45bf000000000000000000000002001e3b818079000000003b080002003a007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 7,
    "FIL_PAGE_PREV": 6,
    "FIL_PAGE_NEXT": 8,
    "FIL_PAGE_LSN": 19514491,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 58,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "8": {
   "hex": "8e1da44900000008000000070000000900000000012723d445bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 8,
    "FIL_PAGE_PREV": 7,
    "FIL_PAGE_NEXT": 9,
    "FIL_PAGE_LSN": 19342292,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "9": {
   "hex": "bb2c4de900000009000000080000000a0000000001277e0c45bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 9,
    "FIL_PAGE_PREV": 8,
    "FIL_PAGE_NEXT": 10,
    "FIL_PAGE_LSN": 19365388,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "10": {
   "hex": "588c75510000000a000000090000000b000000000129c2b145bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 10,
    "FIL_PAGE_PREV": 9,
    "FIL_PAGE_NEXT": 11,
    "FIL_PAGE_LSN": 19514033,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "11": {
   "hex": "a4a521440000000b0000000a0000000c000000000128325b45bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 11,
    "FIL_PAGE_PREV": 10,
    "FIL_PAGE_NEXT": 12,
    "FIL_PAGE_LSN": 19411547,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "12": {
   "hex": "ce896ba20000000c0000000b0000000d0000000001288c8245bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 12,
    "FIL_PAGE_PREV": 11,
    "FIL_PAGE_NEXT": 13,
    "FIL_PAGE_LSN": 19434626,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "13": {
   "hex": "fcc759100000000d0000000c0000000e0000000001288c8245bf000000000000000000000002001e3b818079000000003b0800020076007700000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 13,
    "FIL_PAGE_PREV": 12,
    "FIL_PAGE_NEXT": 14,
    "FIL_PAGE_LSN": 19434626,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 30,
    "PAGE_HEAP_TOP": 15233,
    "PAGE_N_HEAP": 32889,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 15112,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 118,
    "PAGE_N_RECS": 119,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  },
  "14": {
   "hex": "a1c914170000000e0000000dffffffff000000000128dd2b45bf000000000000000000000002001c360c806e0000000035930002006b006c00000000000000000000000000000000009a0000000000000000000000000000000000000000",
   "f": {
    "FIL_PAGE_OFFSET": 14,
    "FIL_PAGE_PREV": 13,
    "FIL_PAGE_NEXT": 4294967295,
    "FIL_PAGE_LSN": 19455275,
    "FIL_PAGE_TYPE": 17855,
    "FIL_PAGE_ARCH_LOG_NO_OR_SPACE_ID": 2,
    "PAGE_N_DIR_SLOTS": 28,
    "PAGE_HEAP_TOP": 13836,
    "PAGE_N_HEAP": 32878,
    "PAGE_FREE": 0,
    "PAGE_GARBAGE": 0,
    "PAGE_LAST_INSERT": 13715,
    "PAGE_DIRECTION": 2,
    "PAGE_N_DIRECTION": 107,
    "PAGE_N_RECS": 108,
    "PAGE_MAX_TRX_ID": 0,
    "PAGE_LEVEL": 0,
    "PAGE_INDEX_ID": 154,
    "PAGE_BTR_SEG_LEAF": {
     "space": 0,
     "page": 0,
     "offset": 0
    },
    "PAGE_BTR_SEG_TOP": {
     "space": 0,
     "page": 0,
     "offset": 0
    }
   }
  }
 }
};
