import okxAccounts from './okx.json' with { type: 'json' }
import { SubstrateAccountUpdate } from './types.js'

export const accountOverrides: SubstrateAccountUpdate[] = [
  {
    publicKey: '0xa7208d10c6622f3f7eca1551de8355fde9de577dbb308d38994ace561738a51f',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kraken.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'exchange_name:kraken.com',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0x502de5798c411799bc2e975aff8a5c542356ab48254d1d96f15acecdca3d7991',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kraken.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'exchange_name:kraken.com',
      },
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x2097f1c23122d11017cfb836836ce2ba19543e1dcedd5dc5d39ae177e393eb08',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kraken.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x74d7ec84c9249fb32e1e4e86f3747aca65d3c4e519072356108956391f4419ca',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x967cccc1ff3d1f37b9e6c8a39d8ba72ad85d35e19cc0717a72f1a21037606144',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 10,
        subCategoryCode: 0,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:address-poisoning-op',
      },
    ],
  },
  {
    publicKey: '0x8167e55fee5bd1cab9465961646ea62dd3793bfec70c1983ba0734d7260bc29d', // 13vg3Mrxm3GL9eXxLsGgLYRueiwFCiMbkdHBL4ZN5aob5D4N
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xa34a249441ffa5f3f9366b6cf44b823825cf5bb5aa4b167302827a61ac9da120',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0xbb381c0e8a555262ef8a290fd468d8a21409ee4c7a54f01c680357d69ef2a676',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x296c8cc292399aaeafad4e8749833db08bdb5ee21ed60de989e51df7d5d13b6f', // 1wKD98HXHf4kr82vZFbWjP54bp3EDbzmkW7nxxZA1H6VgKU
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:gate.io',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x033e762403c2504222426080dd2d33f08448d5779504283fd61bbd4173d574c3', // 15FhX4aeqrb9TKMVqE4J4y3FUBoSkKAmbvhXQb3iN5pFABy
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xdef13599cffaec89ff066f008857330b8c2ff72c92bb85c01db5cfb7082f2979', // 163KHWFRr1xcjkm43Nr7sL4RKXx3nSihQFqWRtWWF7JW2HBX
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xe0e92ca738afe2956313c455dd627652b7028f6c650cd2379f9e832c3ce0ca7e', // 165tzcxR1o2EUkpZVr17DxQsdJwtEkB6HAh69hQubmKGL93f
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x16c1bf15e79d8e619528f4521d655df8e27f0f0ebaa673556950c8ce0cb10a37', // 1WqcGu9P9mi9CrMYx2LYfftki6V6Rr8Zrk5kzGvmwGaQANd
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },

  {
    publicKey: '0x74a60525f80c23421eea370e589831868b110c7cbbacfd3fa4de9d4812eb5a62', // 13dwsdSH99fzyW24M2E42emTjj6jWSj939W4uMaEyeaEpDp4
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:kucoin.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:user_wallet',
      },
    ],
  },
  {
    publicKey: '0x1ea59183db163bbff90a5daff53873b4fb20a9d727b5853528dcc3716aa3844b',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:bitget.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0xef799ac746cfd988ae8d080b159860aa5288da08d1e5fdc509053c3c8ffe015d',
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet', // ?
      },
    ],
  },
  {
    publicKey: '0x5702cc19a122f2d08c2279b59c6366271f43a5ed22ebfd51eb1ba1df5ff81818', // 12y5zpgBTQnQXWpPX5myorneyTmpVKou2uzP6BkMePGs1nCa
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet', // ?
      },
    ],
  },
  {
    publicKey: '0x743a4eddf56f48032d26221155bc834c1352aa8ce39e716166bda6d9d91c50d2', // 13dPsnzjaG3iSM47PHFUN1q5w5nDezTfaq27nL9doDxUEk9g
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet', // ?
      },
    ],
  },
  {
    publicKey: '0xc02036e9045a5e779fbb02cced1793785bb7675436c712d8e4faba2da7d0eaaa', // 15LumHe1Z6pUKvFxP6k5cLH7oZGFLkHqFZdczykifpqbe86H
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet', // ?
      },
    ],
  },
  {
    publicKey: '0xc6ce9ee72a16ad22649cea5f83920bf6cf2cb33e32334e0126d71117ac2480ec', // 15VfruCYXmVNSHfY9DTy3vkQ6mDqMZ2PhCMdL9pdWv5AvSNh
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet', // ?
      },
    ],
  },
  {
    publicKey: '0xf27848a07cb047a043c0b760f8d0d2f4269d10c943251a4faaf662ed41874596', // 16UvKYsqojoivDsNXH3d5G48oXMfo1asxA4NtF2GxhoBjZHz
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xd8f651e453265508090e096f16c4bd790f0405a44973125e469d7742b68800a4', // 15uUWtmKAryDvFxuXHxiHBxRNAMtWBxfYpaNdHU3eAQaDR7C
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x78de611f171008adf68736ddbc9907c68f05630ca67798423e97d1c20af9c183', // 13jUonXyq7xGXu7h6raWUW3YwN6Bx6frwbdRm3kmUQipbHgP
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x91a92c8c06587f123367d7f610bde5495af9e914e2a1c7943660f4911f239007', // 14HzCWd5pN7GM4x5kr6ygQ9VAx5UyKuJxsBypmXXaNPv9Rkk
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x21291584f57d42e2917b315b815495ad118745305430572b8a26613ab0ef9b7b', // 1kUnWmQN1PpioghcUBfmvYtawhdc7zkqf5YCJ25j5tTGUdC
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x8284db2eb72fcbfcf388ca9787899f40354fd4639f225784bd8c57b47a594018', // 13x8h7LzDvGTum5FcXftrxojSbUtdDZqWAtd1VcVemdok2gk
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0xfeca87d9cf846c1f8a2da5162d173b5a13ce7f32e9f8e5006ae161e7fb325bd9', // 16m5KxfBVPuxg7iSyUgY1uxYbY2vd3dM9ptKnVVCHd9H4e9G
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0xff4f46cb25fa7d3e694175a223005a9aa718f0e44534c44781e08bff7e51a6d2', // 16mkm7q1Nrh4Km8FTftphmqUBjQ236wVfSPcV3oDdeiiJh2r
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0xdf054b8f354ad6818a18c3a2fe38628a0c18f4d0c4ef2af941f5c9e5a741cadc', // 163RFaJS3aTACp9cL5pbJ1fRkSU9UwaNKGTcA7eLWhqsKMuu
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x8e946f5b7bcf3cb671b0b7a608606ac0c21beeb972e5536e74c009a9aaf2f180', // 14DwtrX3ZVdKEv7WKLmiba1Fp6ptT6ZDrZWbNgM8u3eWGBZn
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x25603153c05b9f5ca897e5a0f78e38c4fd9b649ae0d145836d496515f25a832e', // 1r1M85CukHdM8nueWcVt2cmYD4WEDgWMBbwmU7Hcm7WKiDb
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x7373118e5602bb8246a5748e7ddea78e223d74f8559088e1ad4f4a3bd5c09cb9', // 13cNgydh5MMHSHthbVwaPg5rYMeHo9uYQaUYgTi8Dtea5amp
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0xc51f566f0c26a351184c4cf1012f93ce74f06c71b4f9ad4b5541736e6ba791b9', // 15TTk4oDbZcHm4ebXtHVBd6nXpqjMZduvkVLYE85RmMa1AxP
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
    ],
  },
  {
    publicKey: '0x1e565a249e4ef744cc5b12e4394d653bf6cd39a84c240b3d75406f0723948713', // 1gn68eNGNGqV3QjVcRRDVfw22xFn1eFyUizHCENVn256LXh
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'exchange_name:okx.com',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x5670f9f348bd7f967539de1856c5b11de4302122233100adb22ceb9846f98b2c', // 12xLgPQunSsPkwMJ3vAgfac7mtU3Xw6R4fbHQcCp2QqXzdtu
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-owner',
      },
    ],
  },
  {
    publicKey: '0x45fd34d372d89f1934e14f99fb3a7a977df9779763d265ce7a450af4d6df8a15', // 12amXH9jF3ob2EqE1a44NKnoFdxz6qsXzmYY17pT84764dLL
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-freezer',
      },
    ],
  },
  {
    publicKey: '0x6c7aa3e3187f04f100c14f7d29ebd9e2cdc7e78d367d46ae099751f72f55da36', // 13TEbzUcFVsdZA1BAWm2TjLMRZ4y2CQDq3JEoiPqXh43MEoa
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-admin',
      },
    ],
  },
  {
    publicKey: '0x383a171d3c8fbbdcc9a831831663cd83f2efd57d0e84776469cc61c347d1dcfe', // 12GiwQK3AYwaQWgjAvFwWG9L3RYoedk9kTSBSYzFKGSfqkEQ
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-issuer',
      },
    ],
  },
  {
    publicKey: '0xc30aa287059cd2bdd121662e18c200b4698ff6fa452b79f70ac63a40a3a690ee', // 15QjVp1rx6tjbBjmaWhhwUV7ESHMG6KjdDdhRuw5dQKWkqzB
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-primary-treasury',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0xa60a3f49c90ee47b5d46a90315365c7046f067e7151b0e353937a09c860aa454', // 14khzbBopeid31EETq8sTz8r9LYcBMTHqrKMnwgQyHkHSwBp
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-secondary-treasury',
      },
    ],
  },
  {
    publicKey: '0x63a56ac41e7f3ce3b847a0863fd98b660a381e2b6d622042011337887cc4189c', // 13Fet2MzBBUbJ2oREa7JJrswGeJPY4p7cY3Z2MC9oash8kzN
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdc-operations',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xd8e5d105e214d8c57e5819fb6d820883f44a617a78a7a6237cb9627ec73a26d2', // 15uPcYeUE2XaMiMJuR6W7QGW2LsLdKXX7F3PxKG8gcizPh3X
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdt-owner',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdt-admin',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdt-issuer',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdt-freezer',
      },
    ],
  },
  {
    publicKey: '0xcc0e5c24c3747188d7b87a04e7681118afafe3507ff34117553f62820c53f754', // 15cZ2zHq5b2fVh8iDqNJKyvHCtwVKWYGqNLQMakHh6e4wicX
    categories: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        categoryCode: 6,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'name:usdt-primary-treasury',
      },
      {
        chainId: 'urn:ocn:polkadot:1000',
        tag: 'address_type:cold_wallet',
      },
    ],
  },
  {
    publicKey: '0x000000000000000000000000000000000000090a',
    evm: [
      {
        address: '0x000000000000000000000000000000000000090a',
        chainId: 'urn:ocn:polkadot:2034',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'protocol:flash-loan-receiver',
      },
    ],
  },
  {
    publicKey: '0x112c208b900bcfc9ff8131d0f45769cb6c7c7d8d',
    evm: [
      {
        address: '0x112c208b900bcfc9ff8131d0f45769cb6c7c7d8d',
        chainId: 'urn:ocn:polkadot:2034',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'protocol:pot-rewards-transfer-strategy',
      },
    ],
  },
  {
    publicKey: '0xffffffffffffffffffffffffffffffffffffffff',
    evm: [
      {
        address: '0xffffffffffffffffffffffffffffffffffffffff',
        chainId: 'urn:ocn:polkadot:2034',
      },
      {
        address: '0xffffffffffffffffffffffffffffffffffffffff',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2034',
        tag: 'system:null',
      },
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'system:null',
      },
    ],
  },
  {
    publicKey: '0xd85bf1bf64265f9cf660b25094a5aa33ac337db3',
    evm: [
      {
        address: '0xd85bf1bf64265f9cf660b25094a5aa33ac337db3',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x4485167772aec1ed2e54038800e0f3890a76cbc7',
    evm: [
      {
        address: '0x4485167772aec1ed2e54038800e0f3890a76cbc7',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0xbf39aa4e1563114382f020754fac47565e299162',
    evm: [
      {
        address: '0xbf39aa4e1563114382f020754fac47565e299162',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x619229df13f518e4c9943c7dcb783d138be79e16',
    evm: [
      {
        address: '0x619229df13f518e4c9943c7dcb783d138be79e16',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x13c81e874190490d9f19df734409fbdbca938d05',
    evm: [
      {
        address: '0x13c81e874190490d9f19df734409fbdbca938d05',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x67d5e7640ca54418a8f490da8181ea8e01c82c84',
    evm: [
      {
        address: '0x67d5e7640ca54418a8f490da8181ea8e01c82c84',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x5795d947864ac9a233ad6e41d8b7daa71f10d1aa',
    evm: [
      {
        address: '0x5795d947864ac9a233ad6e41d8b7daa71f10d1aa',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x4c7f187e9f39ea0ffcf105985cb0417f1174b0a2',
    evm: [
      {
        address: '0x4c7f187e9f39ea0ffcf105985cb0417f1174b0a2',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x30f36c704a22c97774fbeb9df796bd609ed53e70',
    evm: [
      {
        address: '0x30f36c704a22c97774fbeb9df796bd609ed53e70',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x091e463110febf48d45b4ef7ed4d9af2f938df3c',
    evm: [
      {
        address: '0x091e463110febf48d45b4ef7ed4d9af2f938df3c',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x46c8f3f9354cbb0a3228178d299543533f45337e',
    evm: [
      {
        address: '0x46c8f3f9354cbb0a3228178d299543533f45337e',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0x65d42a9d3d62df082233e28ca0e3bbcba11e183a',
    evm: [
      {
        address: '0x65d42a9d3d62df082233e28ca0e3bbcba11e183a',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0xd7033854ae6aa60d03020da557f70fa1a53011a1',
    evm: [
      {
        address: '0xd7033854ae6aa60d03020da557f70fa1a53011a1',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0xa6ec268ff3140d445587f792ad056906883e29fa',
    evm: [
      {
        address: '0xa6ec268ff3140d445587f792ad056906883e29fa',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0xc3d7a5a7846a677257235cdcd57cda8fa1425370',
    evm: [
      {
        address: '0xc3d7a5a7846a677257235cdcd57cda8fa1425370',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 8,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-community-vault',
      },
    ],
  },
  {
    publicKey: '0xaac5b58833a1e4264b0c1da8c0154779c714583b',
    evm: [
      {
        address: '0xaac5b58833a1e4264b0c1da8c0154779c714583b',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-pool',
      },
    ],
  },
  {
    publicKey: '0x921b35e54b45b60ee8142fa234baeb2ff5e307e0',
    evm: [
      {
        address: '0x921b35e54b45b60ee8142fa234baeb2ff5e307e0',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-pool',
      },
    ],
  },
  {
    publicKey: '0x2232e98829f985c95c6930342b607496cad7a560',
    evm: [
      {
        address: '0x2232e98829f985c95c6930342b607496cad7a560',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:algebra-pool',
      },
    ],
  },
  {
    publicKey: '0xad6cea45f98444a922a2b4fe96b8c90f0862d2f4',
    evm: [
      {
        address: '0xad6cea45f98444a922a2b4fe96b8c90f0862d2f4',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:squid-multicall',
      },
    ],
  },
  {
    publicKey: '0xce16f69375520ab01377ce7b88f5ba8c48f8d666',
    evm: [
      {
        address: '0xce16f69375520ab01377ce7b88f5ba8c48f8d666',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:squid-router',
      },
    ],
  },
  {
    publicKey: '0x2d5d7d31f671f86c782533cc367f14109a082712',
    evm: [
      {
        address: '0x2d5d7d31f671f86c782533cc367f14109a082712',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:axelar-gas-service',
      },
    ],
  },
  {
    publicKey: '0x571fc4e209686a0d7e1502ec4c4bcbf1d96a2211',
    evm: [
      {
        address: '0x571fc4e209686a0d7e1502ec4c4bcbf1d96a2211',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:moondrop',
      },
    ],
  },
  {
    publicKey: '0x5c3dc0ab1bd70c5cdc8d0865e023164d4d3fd8ec',
    evm: [
      {
        address: '0x5c3dc0ab1bd70c5cdc8d0865e023164d4d3fd8ec',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:swap-flash-loan',
      },
    ],
  },
  {
    publicKey: '0xf4c10263f2a4b1f75b8a5fd5328fb61605321639',
    evm: [
      {
        address: '0xf4c10263f2a4b1f75b8a5fd5328fb61605321639',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-swap-v2-pair',
      },
    ],
  },
  {
    publicKey: '0xf3a5454496e26ac57da879bf3285fa85debf0388',
    evm: [
      {
        address: '0xf3a5454496e26ac57da879bf3285fa85debf0388',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-distributor-v2',
      },
    ],
  },
  {
    publicKey: '0x051fcf8986b30860a1341e0031e5622bd18d8a85',
    evm: [
      {
        address: '0x051fcf8986b30860a1341e0031e5622bd18d8a85',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:stella-swap-v2-pair',
      },
    ],
  },
  {
    publicKey: '0xe93685f3bba03016f02bd1828badd6195988d950',
    evm: [
      {
        address: '0xe93685f3bba03016f02bd1828badd6195988d950',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 3,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:layer-zero-executor',
      },
    ],
  },
  {
    publicKey: '0x8e00d5e02e65a19337cdba98bba9f84d4186a180',
    evm: [
      {
        address: '0x8e00d5e02e65a19337cdba98bba9f84d4186a180',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 2,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:moonwell-comptroller-v1',
      },
    ],
  },
  {
    publicKey: '0x26a2abd79583155ea5d34443b62399879d42748a',
    evm: [
      {
        address: '0x26a2abd79583155ea5d34443b62399879d42748a',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: '0x58be9bb19c25cbc8a1533c1a9cf5c6bef5d1638e',
    evm: [
      {
        address: '0x58be9bb19c25cbc8a1533c1a9cf5c6bef5d1638e',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: '0x444ae1ed8f4674428178554b56519af52f654337',
    evm: [
      {
        address: '0x444ae1ed8f4674428178554b56519af52f654337',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:solarflare-pair',
      },
    ],
  },
  {
    publicKey: '0x7d393bc51b2fc7015c2c9c781feb288054015b7e',
    evm: [
      {
        address: '0x7d393bc51b2fc7015c2c9c781feb288054015b7e',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 2,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'protocol:beamswap-pair',
      },
    ],
  },
  {
    publicKey: '0xf977814e90da44bfa03b6295a0616a897441acec',
    evm: [
      {
        address: '0xf977814e90da44bfa03b6295a0616a897441acec',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:binance.com',
      },
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0xf3918988eb3ce66527e2a1a4d42c303915ce28ce',
    evm: [
      {
        address: '0xf3918988eb3ce66527e2a1a4d42c303915ce28ce',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:binance.com',
      },
    ],
  },
  {
    publicKey: '0x76ec5a0d3632b2133d9f1980903305b62678fbd3',
    evm: [
      {
        address: '0x76ec5a0d3632b2133d9f1980903305b62678fbd3',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:btcturk',
      },
    ],
  },
  {
    publicKey: '0xf89d7b9c864f589bbf53a82105107622b35eaa40',
    evm: [
      {
        address: '0xf89d7b9c864f589bbf53a82105107622b35eaa40',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bybit.com',
      },
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'address_type:hot_wallet',
      },
    ],
  },
  {
    publicKey: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
    evm: [
      {
        address: '0x0d0707963952f2fba59dd06f2b425ace40b492fe',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:gate.io',
      },
    ],
  },
  {
    publicKey: '0xab782bc7d4a2b306825de5a7730034f8f63ee1bc',
    evm: [
      {
        address: '0xab782bc7d4a2b306825de5a7730034f8f63ee1bc',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitvavo',
      },
    ],
  },
  {
    publicKey: '0x377b8ce04761754e8ac153b47805a9cf6b190873',
    evm: [
      {
        address: '0x377b8ce04761754e8ac153b47805a9cf6b190873',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:upbit',
      },
    ],
  },
  {
    publicKey: '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef',
    evm: [
      {
        address: '0x5bdf85216ec1e38d6458c870992a69e38e03f7ef',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitget.com',
      },
    ],
  },
  {
    publicKey: '0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1',
    evm: [
      {
        address: '0xf35a6bd6e0459a4b53a27862c51a2a7292b383d1',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:coinspot',
      },
    ],
  },
  {
    publicKey: '0x0529ea5885702715e83923c59746ae8734c553b7',
    evm: [
      {
        address: '0x0529ea5885702715e83923c59746ae8734c553b7',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:bitpanda',
      },
    ],
  },
  {
    publicKey: '0xf0bc8fddb1f358cef470d63f96ae65b1d7914953',
    evm: [
      {
        address: '0xf0bc8fddb1f358cef470d63f96ae65b1d7914953',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:korbit',
      },
    ],
  },
  {
    publicKey: '0xff4606bd3884554cdbdabd9b6e25e2fad4f6fc54',
    evm: [
      {
        address: '0xff4606bd3884554cdbdabd9b6e25e2fad4f6fc54',
        chainId: 'urn:ocn:polkadot:2004',
      },
    ],
    categories: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        categoryCode: 1,
        subCategoryCode: 1,
      },
    ],
    tags: [
      {
        chainId: 'urn:ocn:polkadot:2004',
        tag: 'exchange_name:swissborg',
      },
    ],
  },
  ...(okxAccounts as SubstrateAccountUpdate[]),
]
