-- Postnumre med by, kommune og region.
-- Kilde: PostNords postnummerfil fra oktober 2020 via npm-pakken dk-postals (ISC). Rå fil: data/seeds/postnord_postnumre_2020_raa.csv.
-- Region er pålidelig. Kommune er vejledende, fordi et postnummer kan ligge i flere kommuner.
-- region_ambiguous markerer 22 postnumre, der ligger i flere regioner.
-- OBS: denne fil indeholder 43 manuelle rettelser. Migration 20261015210000 gendanner PostNords oprindelige værdier, så den samlede database svarer til kildefilen.
alter table public.postcode add column if not exists region_ambiguous boolean not null default false;

insert into public.postcode (postal_code, city, municipality, region, region_ambiguous)
select pc, split_part(l,'|',1), split_part(l,'|',2),
       case left(split_part(l,'|',3),1) when 'H' then 'Region Hovedstaden' when 'S' then 'Region Sjælland'
            when 'M' then 'Region Midtjylland' when 'N' then 'Region Nordjylland' when 'D' then 'Region Syddanmark' end,
       right(split_part(l,'|',3),1) = '*'
from string_to_table($pc$
København K|København|H|1000 1050 1051 1052 1053 1054 1055 1056 1057 1058 1059 1060 1061 1062 1063 1064 1065 1066 1067 1068 1069 1070 1071 1072 1073 1074 1092 1093 1095 1098 1100 1101 1102 1103 1104 1105 1106 1107 1110 1111 1112 1113 1114 1115 1116 1117 1118 1119 1120 1121 1122 1123 1124 1125 1126 1127 1128 1129 1130 1131 1140 1147 1148 1150 1151 1152 1153 1154 1155 1156 1157 1158 1159 1160 1161 1162 1164 1165 1166 1167 1168 1169 1170 1171 1172 1173 1174 1175 1200 1201 1202 1203 1204 1205 1206 1207 1208 1209 1210 1211 1213 1214 1215 1216 1217 1218 1219 1220 1221 1240 1250 1251 1252 1253 1254 1255 1256 1257 1259 1260 1261 1263 1264 1265 1266 1267 1268 1270 1271 1300 1301 1302 1303 1304 1306 1307 1308 1309 1310 1311 1312 1313 1314 1315 1316 1317 1318 1319 1320 1321 1322 1323 1324 1325 1326 1327 1328 1329 1350 1352 1353 1354 1355 1356 1357 1358 1359 1360 1361 1362 1363 1364 1365 1366 1367 1368 1369 1370 1371 1400 1401 1402 1403 1406 1407 1408 1409 1410 1411 1412 1413 1414 1415 1416 1417 1418 1419 1420 1421 1422 1423 1424 1425 1426 1427 1428 1429 1430 1432 1433 1434 1435 1436 1437 1438 1439 1440 1441 1448 1450 1451 1452 1453 1454 1455 1456 1457 1458 1459 1460 1462 1463 1464 1466 1467 1468 1470 1471 1472 1473
København V|København|H|1500
København V|Tårnby|H|1532 1533
København V|København|H|1550 1551 1552 1553 1554 1555 1556 1557 1558 1559 1560 1561 1562 1563 1564 1566 1567 1568 1569 1570 1571 1572 1573 1574 1575 1576 1577 1592 1599 1600 1601 1602 1603 1604 1605 1606 1607 1608 1609 1610 1611 1612 1613 1614 1615 1616 1617 1618 1619 1620 1621 1622 1623 1624 1630 1631 1632 1633 1634 1635 1650 1651 1652 1653 1654 1655 1656 1657 1658 1659 1660 1661 1662 1663 1664 1665 1666 1667 1668 1669 1670 1671 1672 1673 1674 1675 1676 1677 1699 1700 1701 1702 1703 1704 1705 1706 1707 1708 1709 1710 1711 1712 1714 1715 1716 1717 1718 1719 1720 1721 1722 1723 1724 1725 1726 1727 1728 1729 1730 1731 1732 1733 1734 1735 1736 1737 1738 1739 1749 1750 1751 1752 1753 1754 1755 1756 1757 1758 1759 1760 1761 1762 1763 1764 1765 1766 1770 1771 1772 1773 1774 1775 1777 1780 1785 1786 1787 1790 1799
Frederiksberg C|Frederiksberg|H|1800 1801 1802 1803 1804 1805 1806 1807 1808 1809 1810 1811 1812 1813 1814 1815 1816 1817 1818 1819 1820 1822 1823 1824 1825 1826 1827 1828 1829 1850 1851 1852 1853 1854 1855 1856 1857 1860 1861 1862 1863 1864 1865 1866 1867 1868 1870 1871 1872 1873 1874 1875 1876 1877 1878 1879 1900 1901 1902 1903 1904 1905 1906 1908 1909 1910 1911 1912 1913 1914 1915 1916 1917 1920 1921 1922 1923 1924 1925 1926 1927 1928 1950 1951 1952 1953 1954 1955 1956 1957 1958 1959 1960 1961 1962 1963 1964 1965 1966 1967 1970 1971 1972 1973 1974
Frederiksberg|Frederiksberg|H|2000
København Ø|København|H|2100
Nordhavn|København|H|2150
København N|København|H|2200
København S|København|H|2300
København NV|København|H|2400
København SV|København|H|2450
Valby|København|H|2500
Glostrup|Glostrup|H|2600
Brøndby|Brøndby|H|2605
Rødovre|Rødovre|H|2610
Albertslund|Albertslund|H|2620
Vallensbæk|Vallensbæk|H|2625
Taastrup|Høje-Taastrup|H|2630
Ishøj|Ishøj|H|2635
Hedehusene|Høje-Taastrup|H*|2640
Hvidovre|Hvidovre|H|2650
Brøndby Strand|Brøndby|H|2660
Vallensbæk Strand|Vallensbæk|H|2665
Greve|Greve|S|2670
Solrød Strand|Solrød|S|2680
Karlslunde|Greve|S|2690
Brønshøj|København|H|2700
Vanløse|København|H|2720
Herlev|Herlev|H|2730
Skovlunde|Ballerup|H|2740
Ballerup|Ballerup|H|2750
Måløv|Ballerup|H|2760
Smørum|Egedal|H|2765
Kastrup|København|H|2770
Dragør|Dragør|H|2791
Kongens Lyngby|Lyngby-Taarbæk|H|2800
Gentofte|Gentofte|H|2820
Virum|Lyngby-Taarbæk|H|2830
Holte|Lyngby-Taarbæk|H|2840
Nærum|Rudersdal|H|2850
Søborg|København|H|2860
Dyssegård|Gentofte|H|2870
Bagsværd|Gladsaxe|H|2880
Hellerup|København|H|2900
Charlottenlund|Gentofte|H|2920
Klampenborg|Gentofte|H|2930
Skodsborg|Rudersdal|H|2942
Vedbæk|Hørsholm|H|2950
Rungsted Kyst|Hørsholm|H|2960
Hørsholm|Hørsholm|H|2970
Kokkedal|Fredensborg|H|2980
Nivå|Fredensborg|H|2990
Helsingør|Helsingør|H|3000
Humlebæk|Fredensborg|H|3050
Espergærde|Fredensborg|H|3060
Snekkersten|Helsingør|H|3070
Tikøb|Helsingør|H|3080
Hornbæk|Helsingør|H|3100
Dronningmølle|Gribskov|H|3120
Ålsgårde|Helsingør|H|3140
Hellebæk|Helsingør|H|3150
Helsinge|Gribskov|H|3200
Vejby|Gribskov|H|3210
Tisvildeleje|Gribskov|H|3220
Græsted|Gribskov|H|3230
Gilleleje|Gribskov|H|3250
Frederiksværk|Halsnæs|H|3300
Ølsted|Frederiksværk|H|3310
Skævinge|Hillerød|H|3320
Gørløse|Hillerød|H|3330
Liseleje|Halsnæs|H|3360
Melby|Halsnæs|H|3370
Hundested|Halsnæs|H|3390
Hillerød|Hillerød|H|3400
Allerød|Allerød|H|3450
Birkerød|Rudersdal|H|3460
Fredensborg|Fredensborg|H|3480
Kvistgård|Fredensborg|H|3490
Værløse|Furesø|H|3500
Farum|Furesø|H|3520
Lynge|Allerød|H|3540
Slangerup|Frederikssund|H|3550
Frederikssund|Frederikssund|H|3600
Jægerspris|Frederikssund|H|3630
Ølstykke|Egedal|H|3650
Stenløse|Egedal|H|3660
Veksø Sjælland|Egedal|H*|3670
Rønne|Bornholm|H|3700
Aakirkeby|Bornholm|H|3720
Nexø|Bornholm|H|3730
Svaneke|Bornholm|H|3740
Østermarie|Bornholm|H|3751
Gudhjem|Bornholm|H|3760
Allinge|Bornholm|H|3770
Klemensker|Bornholm|H|3782
Hasle|Bornholm|H|3790
Roskilde|Roskilde|S*|4000
Tune|Greve|S|4030
Jyllinge|Roskilde|S|4040
Skibby|Frederikssund|H|4050
Kirke Såby|Lejre|S|4060
Kirke Hyllinge|Lejre|S|4070
Ringsted|Ringsted|S|4100
Viby Sjælland|Køge|S|4130
Borup|Køge|S|4140
Herlufmagle|Faxe|S|4160
Glumsø|Næstved|S|4171
Fjenneslev|Ringsted|S|4173
Jystrup Midtsj|Køge|S|4174
Sorø|Sorø|S|4180
Munke Bjergby|Slagelse|S|4190
Slagelse|Slagelse|S|4200
Korsør|Slagelse|S|4220
Skælskør|Slagelse|S|4230
Vemmelev|Slagelse|S|4241
Boeslunde|Slagelse|S|4242
Rude|Slagelse|S|4243
Agersø|Slagelse|S|4244
Omø|Slagelse|S|4245
Fuglebjerg|Slagelse|S|4250
Dalmose|Slagelse|S|4261
Sandved|Slagelse|S|4262
Høng|Kalundborg|S|4270
Gørlev|Kalundborg|S|4281
Ruds Vedby|Kalundborg|S|4291
Dianalund|Kalundborg|S|4293
Stenlille|Holbæk|S|4295
Nyrup|Holbæk|S|4296
Holbæk|Holbæk|S|4300
Orø|Holbæk|S|4305
Lejre|Lejre|S|4320
Hvalsø|Holbæk|S|4330
Tølløse|Holbæk|S|4340
Ugerløse|Holbæk|S|4350
Kirke Eskilstrup|Holbæk|S|4360
Store Merløse|Holbæk|S|4370
Vipperød|Holbæk|S|4390
Kalundborg|Kalundborg|S|4400
Regstrup|Holbæk|S|4420
Mørkøv|Holbæk|S|4440
Jyderup|Holbæk|S|4450
Snertinge|Holbæk|S|4460
Svebølle|Holbæk|S|4470
Store Fuglede|Kalundborg|S|4480
Jerslev Sjælland|Kalundborg|S|4490
Nykøbing Sj|Odsherred|S|4500
Svinninge|Holbæk|S|4520
Gislinge|Holbæk|S|4532
Hørve|Odsherred|S|4534
Fårevejle|Odsherred|S|4540
Asnæs|Odsherred|S|4550
Vig|Odsherred|S|4560
Grevinge|Odsherred|S|4571
Nørre Asmindrup|Odsherred|S|4572
Højby|Odsherred|S|4573
Rørvig|Odsherred|S|4581
Sjællands Odde|Odsherred|S|4583
Føllenslev|Odsherred|S|4591
Sejerø|Kalundborg|S|4592
Eskebjerg|Kalundborg|S|4593
Køge|Køge|S|4600
Gadstrup|Roskilde|S|4621
Havdrup|Roskilde|S|4622
Lille Skensved|Køge|S|4623
Bjæverskov|Køge|S|4632
Faxe|Faxe|S|4640
Hårlev|Faxe|S|4652
Karise|Faxe|S|4653
Faxe Ladeplads|Faxe|S|4654
Store Heddinge|Stevns|S|4660
Strøby|Stevns|S|4671
Klippinge|Stevns|S|4672
Rødvig Stevns|Stevns|S|4673
Herfølge|Køge|S|4681
Tureby|Køge|S|4682
Rønnede|Faxe|S|4683
Holmegaard|Faxe|S|4684
Haslev|Faxe|S|4690
Næstved|Næstved|S|4700
Præstø|Vordingborg|S|4720
Tappernøje|Faxe|S|4733
Mern|Vordingborg|S|4735
Karrebæksminde|Næstved|S|4736
Lundby|Næstved|S|4750
Vordingborg|Vordingborg|S|4760
Kalvehave|Vordingborg|S|4771
Langebæk|Vordingborg|S|4772
Stensved|Vordingborg|S|4773
Stege|Vordingborg|S|4780
Borre|Vordingborg|S|4791
Askeby|Vordingborg|S|4792
Bogø By|Vordingborg|S|4793
Nykøbing F|Guldborgsund|S|4800
Nørre Alslev|Guldborgsund|S|4840
Stubbekøbing|Guldborgsund|S|4850
Guldborg|Guldborgsund|S|4862
Eskilstrup|Guldborgsund|S|4863
Horbelev|Guldborgsund|S|4871
Idestrup|Guldborgsund|S|4872
Væggerløse|Guldborgsund|S|4873
Gedser|Guldborgsund|S|4874
Nysted|Guldborgsund|S|4880
Toreby L|Guldborgsund|S|4891
Kettinge|Guldborgsund|S|4892
Øster Ulslev|Lolland|S|4894
Errindlev|Lolland|S|4895
Nakskov|Lolland|S|4900
Harpelunde|Lolland|S|4912
Horslunde|Lolland|S|4913
Søllested|Lolland|S|4920
Maribo|Lolland|S|4930
Bandholm|Lolland|S|4941
Askø|Lolland|S|4942
Torrig L|Lolland|S|4943
Fejø|Lolland|S|4944
Femø|Lolland|S|4945
Nørreballe|Lolland|S|4951
Stokkemarke|Lolland|S|4952
Vesterborg|Lolland|S|4953
Holeby|Lolland|S|4960
Rødby|Lolland|S|4970
Dannemare|Lolland|S|4983
Sakskøbing|Guldborgsund|S|4990
Odense C|Odense|D|5000
Odense V|Odense|D|5200
Odense NV|Odense|D|5210
Odense SØ|Odense|D|5220
Odense M|Odense|D|5230
Odense NØ|Odense|D|5240
Odense SV|Odense|D|5250
Odense S|Odense|D|5260
Odense N|Odense|D|5270
Marslev|Kerteminde|D|5290
Kerteminde|Kerteminde|D|5300
Agedrup|Odense|D|5320
Munkebo|Kerteminde|D|5330
Rynkeby|Kerteminde|D|5350
Mesinge|Kerteminde|D|5370
Dalby|Kerteminde|D|5380
Martofte|Kerteminde|D|5390
Bogense|Nordfyns|D|5400
Otterup|Nordfyns|D|5450
Morud|Nordfyns|D|5462
Harndrup|Middelfart|D|5463
Brenderup Fyn|Middelfart|D|5464
Asperup|Middelfart|D|5466
Søndersø|Nordfyns|D|5471
Veflinge|Nordfyns|D|5474
Skamby|Nordfyns|D|5485
Blommenslyst|Odense|D|5491
Vissenbjerg|Assens|D|5492
Middelfart|Middelfart|D|5500
Ullerslev|Kerteminde|D|5540
Langeskov|Faaborg-Midtfyn|D|5550
Aarup|Middelfart|D|5560
Nørre Aaby|Middelfart|D|5580
Gelsted|Middelfart|D|5591
Ejby|Middelfart|D|5592
Faaborg|Faaborg-Midtfyn|D|5600
Lyø|Faaborg-Midtfyn|D|5601
Avernakø|Faaborg-Midtfyn|D|5602
Bjørnø|Faaborg-Midtfyn|D|5603
Assens|Assens|D|5610
Glamsbjerg|Assens|D|5620
Ebberup|Assens|D|5631
Millinge|Assens|D|5642
Broby|Faaborg-Midtfyn|D|5672
Haarby|Assens|D|5683
Tommerup|Assens|D|5690
Svendborg|Svendborg|D|5700
Ringe|Faaborg-Midtfyn|D|5750
Vester Skerninge|Faaborg-Midtfyn|D|5762
Stenstrup|Faaborg-Midtfyn|D|5771
Kværndrup|Faaborg-Midtfyn|D|5772
Årslev|Faaborg-Midtfyn|D|5792
Nyborg|Nyborg|D|5800
Ørbæk|Faaborg-Midtfyn|D|5853
Gislev|Faaborg-Midtfyn|D|5854
Ryslinge|Faaborg-Midtfyn|D|5856
Ferritslev Fyn|Faaborg-Midtfyn|D|5863
Frørup|Nyborg|D|5871
Hesselager|Nyborg|D|5874
Skårup Fyn|Svendborg|D|5881
Vejstrup|Svendborg|D|5882
Oure|Svendborg|D|5883
Gudme|Svendborg|D|5884
Gudbjerg Sydfyn|Svendborg|D|5892
Rudkøbing|Langeland|D|5900
Humble|Langeland|D|5932
Bagenkop|Langeland|D|5935
Strynø|Langeland|D|5943
Tranekær|Langeland|D|5953
Marstal|Ærø|D|5960
Birkholm|Ærø|D|5965
Ærøskøbing|Ærø|D|5970
Søby Ærø|Ærø|D|5985
Kolding|Kolding|D|6000
Egtved|Kolding|D|6040
Almind|Kolding|D|6051
Viuf|Kolding|D|6052
Jordrup|Kolding|D|6064
Christiansfeld|Haderslev|D|6070
Bjert|Kolding|D|6091
Sønder Stenderup|Kolding|D|6092
Sjølund|Kolding|D|6093
Hejls|Haderslev|D|6094
Haderslev|Haderslev|D|6100
Aabenraa|Aabenraa|D|6200
Barsø|Aabenraa|D|6210
Rødekro|Aabenraa|D|6230
Løgumkloster|Tønder|D|6240
Bredebro|Tønder|D|6261
Tønder|Tønder|D|6270
Højer|Tønder|D|6280
Gråsten|Sønderborg|D|6300
Broager|Sønderborg|D|6310
Egernsund|Sønderborg|D|6320
Padborg|Aabenraa|D|6330
Kruså|Aabenraa|D|6340
Tinglev|Aabenraa|D|6360
Bylderup-Bov|Aabenraa|D|6372
Bolderslev|Aabenraa|D|6392
Sønderborg|Sønderborg|D|6400
Nordborg|Sønderborg|D|6430
Augustenborg|Sønderborg|D|6440
Sydals|Sønderborg|D|6470
Vojens|Haderslev|D|6500
Gram|Haderslev|D|6510
Toftlund|Haderslev|D|6520
Agerskov|Haderslev|D|6534
Branderup J|Tønder|D|6535
Bevtoft|Haderslev|D|6541
Sommersted|Haderslev|D|6560
Vamdrup|Kolding|D|6580
Vejen|Vejen|D|6600
Gesten|Vejen|D|6621
Bække|Vejen|D|6622
Vorbasse|Billund|D|6623
Rødding|Haderslev|D|6630
Lunderskov|Kolding|D|6640
Brørup|Vejen|D|6650
Lintrup|Vejen|D|6660
Holsted|Esbjerg|D|6670
Hovborg|Billund|D|6682
Føvling|Esbjerg|D|6683
Gørding|Esbjerg|D|6690
Esbjerg|Esbjerg|D|6700
Esbjerg Ø|Esbjerg|D|6705
Esbjerg V|Esbjerg|D|6710
Esbjerg N|Esbjerg|D|6715
Fanø|Fanø|D|6720
Tjæreborg|Esbjerg|D|6731
Bramming|Esbjerg|D|6740
Glejbjerg|Vejen|D|6752
Agerbæk|Varde|D|6753
Ribe|Esbjerg|D|6760
Gredstedbro|Esbjerg|D|6771
Skærbæk|Tønder|D|6780
Rømø|Tønder|D|6792
Varde|Varde|D|6800
Årre|Esbjerg|D|6818
Ansager|Billund|D|6823
Nørre Nebel|Varde|D*|6830
Oksbøl|Varde|D|6840
Janderup Vestj|Varde|D|6851
Billum|Varde|D|6852
Vejers Strand|Varde|D|6853
Henne|Varde|D|6854
Outrup|Varde|D|6855
Blåvand|Varde|D|6857
Tistrup|Varde|D|6862
Ølgod|Varde|D*|6870
Tarm|Ringkøbing-Skjern|M*|6880
Hemmet|Ringkøbing-Skjern|M|6893
Skjern|Ringkøbing-Skjern|M|6900
Videbæk|Ringkøbing-Skjern|M|6920
Kibæk|Herning|M|6933
Lem St|Ringkøbing-Skjern|M|6940
Ringkøbing|Ringkøbing-Skjern|M|6950
Hvide Sande|Ringkøbing-Skjern|M|6960
Spjald|Ringkøbing-Skjern|M|6971
Ørnhøj|Herning|M|6973
Tim|Ringkøbing-Skjern|M|6980
Ulfborg|Herning|M|6990
Fredericia|Fredericia|D|7000 7007
Børkop|Vejle|D|7080
Vejle|Vejle|D*|7100
Vejle Øst|Vejle|D*|7120
Juelsminde|Hedensted|M|7130
Stouby|Hedensted|M|7140
Barrit|Hedensted|M|7150
Tørring|Hedensted|M*|7160
Uldum|Hedensted|M|7171
Vonge|Vejle|D|7173
Bredsten|Vejle|D|7182
Randbøl|Vejle|D|7183
Vandel|Vejle|D|7184
Billund|Billund|D|7190
Grindsted|Billund|D|7200
Hejnsvig|Billund|D|7250
Sønder Omme|Billund|D*|7260
Stakroge|Billund|D*|7270
Sønder Felding|Herning|M|7280
Jelling|Vejle|D|7300
Gadbjerg|Vejle|D|7321
Give|Vejle|D*|7323
Brande|Ikast-Brande|M*|7330
Ejstrupholm|Ikast-Brande|M*|7361
Hampen|Silkeborg|M|7362
Herning|Herning|M|7400
Ikast|Ikast-Brande|M|7430
Bording|Silkeborg|M|7441
Engesvang|Silkeborg|M|7442
Sunds|Herning|M|7451
Karup J|Herning|M|7470
Vildbjerg|Herning|M|7480
Aulum|Herning|M|7490
Holstebro|Holstebro|M|7500
Haderup|Herning|M|7540
Sørvad|Herning|M|7550
Hjerm|Holstebro|M|7560
Vemb|Holstebro|M|7570
Struer|Struer|M|7600
Lemvig|Lemvig|M|7620
Bøvlingbjerg|Lemvig|M|7650
Bækmarksbro|Lemvig|M|7660
Harboøre|Lemvig|M|7673
Thyborøn|Lemvig|M|7680
Thisted|Thisted|N|7700
Hanstholm|Thisted|N|7730
Frøstrup|Thisted|N|7741
Vesløs|Thisted|N|7742
Snedsted|Thisted|N|7752
Bedsted Thy|Thisted|N|7755
Hurup Thy|Thisted|N*|7760
Vestervig|Thisted|N|7770
Thyholm|Struer|M|7790
Skive|Skive|M|7800
Vinderup|Holstebro|M|7830
Højslev|Skive|M|7840
Stoholm Jyll|Viborg|M|7850
Spøttrup|Skive|M|7860
Roslev|Skive|M|7870
Fur|Skive|M|7884
Nykøbing M|Morsø|N|7900
Erslev|Morsø|N|7950
Karby|Morsø|N|7960
Redsted M|Morsø|N|7970
Vils|Morsø|N|7980
Øster Assels|Morsø|N|7990
Aarhus C|Aarhus|M|8000
Aarhus N|Aarhus|M|8200
Aarhus V|Aarhus|M|8210
Brabrand|Aarhus|M|8220
Åbyhøj|Aarhus|M|8230
Risskov|Aarhus|M|8240
Risskov Ø|Aarhus|M|8245
Egå|Aarhus|M|8250
Viby J|Aarhus|M|8260
Højbjerg|Aarhus|M|8270
Odder|Odder|M|8300
Samsø|Samsø|M|8305
Tranbjerg J|Aarhus|M|8310
Mårslet|Aarhus|M|8320
Beder|Aarhus|M|8330
Malling|Odder|M|8340
Hundslund|Odder|M|8350
Solbjerg|Aarhus|M|8355
Hasselager|Aarhus|M|8361
Hørning|Skanderborg|M|8362
Hadsten|Favrskov|M|8370
Trige|Aarhus|M|8380
Tilst|Aarhus|M|8381
Hinnerup|Favrskov|M|8382
Ebeltoft|Syddjurs|M|8400
Rønde|Syddjurs|M|8410
Knebel|Syddjurs|M|8420
Balle|Syddjurs|M|8444
Hammel|Favrskov|M|8450
Harlev J|Aarhus|M|8462
Galten|Skanderborg|M|8464
Sabro|Aarhus|M|8471
Sporup|Favrskov|M|8472
Grenaa|Norddjurs|M|8500
Lystrup|Aarhus|M|8520
Hjortshøj|Aarhus|M|8530
Skødstrup|Aarhus|M|8541
Hornslet|Syddjurs|M|8543
Mørke|Syddjurs|M|8544
Ryomgård|Syddjurs|M|8550
Kolind|Syddjurs|M|8560
Trustrup|Syddjurs|M|8570
Nimtofte|Syddjurs|M|8581
Glesborg|Norddjurs|M|8585
Ørum Djurs|Norddjurs|M|8586
Anholt|Norddjurs|M|8592
Silkeborg|Silkeborg|M|8600
Kjellerup|Silkeborg|M|8620
Lemming|Silkeborg|M|8632
Sorring|Silkeborg|M|8641
Ans By|Silkeborg|M|8643
Them|Silkeborg|M|8653
Bryrup|Silkeborg|M|8654
Skanderborg|Skanderborg|M|8660
Låsby|Skanderborg|M|8670
Ry|Skanderborg|M|8680
Horsens|Horsens|M|8700
Daugård|Hedensted|M|8721
Hedensted|Hedensted|M|8722
Løsning|Hedensted|M|8723
Hovedgård|Horsens|M|8732
Brædstrup|Horsens|M|8740
Gedved|Horsens|M|8751
Østbirk|Horsens|M|8752
Flemming|Horsens|M|8762
Rask Mølle|Hedensted|M|8763
Klovborg|Horsens|M|8765
Nørre Snede|Ikast-Brande|M|8766
Stenderup|Horsens|M|8781
Hornsyld|Horsens|M|8783
Endelave|Horsens|M|8789
Tunø|Odder|M|8799
Viborg|Viborg|M|8800
Tjele|Viborg|M|8830
Løgstrup|Viborg|M|8831
Skals|Viborg|M|8832
Rødkærsbro|Viborg|M|8840
Bjerringbro|Viborg|M|8850
Ulstrup|Favrskov|M|8860
Langå|Randers|M|8870
Thorsø|Favrskov|M|8881
Fårvang|Silkeborg|M|8882
Gjern|Silkeborg|M|8883
Randers C|Randers|M|8900
Randers NV|Randers|M|8920
Randers NØ|Randers|M|8930
Randers SV|Randers|M|8940
Ørsted|Norddjurs|M|8950
Randers SØ|Randers|M|8960
Allingåbro|Norddjurs|M|8961
Auning|Norddjurs|M|8963
Havndal|Randers|M*|8970
Spentrup|Randers|M|8981
Gjerlev J|Randers|M|8983
Fårup|Randers|M*|8990
Aalborg|Aalborg|N|9000
Aalborg SV|Aalborg|N|9200
Aalborg SØ|Aalborg|N|9210
Aalborg Øst|Aalborg|N|9220
Svenstrup J|Aalborg|N|9230
Nibe|Aalborg|N|9240
Gistrup|Aalborg|N|9260
Klarup|Aalborg|N|9270
Storvorde|Aalborg|N|9280
Kongerslev|Rebild|N|9293
Sæby|Frederikshavn|N|9300
Vodskov|Aalborg|N|9310
Hjallerup|Brønderslev|N|9320
Dronninglund|Brønderslev|N|9330
Asaa|Brønderslev|N|9340
Dybvad|Brønderslev|N|9352
Gandrup|Aalborg|N|9362
Hals|Aalborg|N|9370
Vestbjerg|Aalborg|N|9380
Sulsted|Aalborg|N|9381
Tylstrup|Brønderslev|N|9382
Nørresundby|Aalborg|N|9400
Vadum|Jammerbugt|N|9430
Aabybro|Jammerbugt|N|9440
Brovst|Jammerbugt|N|9460
Løkken|Hjørring|N|9480
Pandrup|Jammerbugt|N|9490
Blokhus|Jammerbugt|N|9492
Saltum|Jammerbugt|N|9493
Hobro|Mariagerfjord|N*|9500
Arden|Rebild|N|9510
Skørping|Rebild|N|9520
Støvring|Rebild|N|9530
Suldrup|Rebild|N|9541
Mariager|Mariagerfjord|N*|9550
Hadsund|Mariagerfjord|N|9560
Bælum|Rebild|N|9574
Terndrup|Rebild|N|9575
Aars|Vesthimmerlands|N|9600
Nørager|Rebild|N|9610
Aalestrup|Vesthimmerlands|N*|9620
Gedsted|Vesthimmerlands|N*|9631
Møldrup|Vesthimmerlands|N*|9632
Farsø|Vesthimmerlands|N|9640
Løgstør|Vesthimmerlands|N|9670
Ranum|Vesthimmerlands|N|9681
Fjerritslev|Jammerbugt|N|9690
Brønderslev|Brønderslev|N|9700
Jerslev J|Brønderslev|N|9740
Østervrå|Frederikshavn|N|9750
Vrå|Hjørring|N|9760
Hjørring|Hjørring|N|9800
Tårs|Hjørring|N|9830
Hirtshals|Hjørring|N|9850
Sindal|Hjørring|N|9870
Bindslev|Hjørring|N|9881
Frederikshavn|Frederikshavn|N|9900
Læsø|Læsø|N|9940
Strandby|Frederikshavn|N|9970
Jerup|Frederikshavn|N|9981
Ålbæk|Frederikshavn|N|9982
Skagen|Frederikshavn|N|9990
$pc$, E'\n') as t(l),
     unnest(string_to_array(split_part(l,'|',4), ' ')) as pc
where l <> ''
on conflict (postal_code) do update set city = excluded.city, municipality = excluded.municipality,
  region = excluded.region, region_ambiguous = excluded.region_ambiguous;
-- Gendanner PostNords oprindelige værdier for de 43 postnumre, der tidligere var rettet manuelt. Rettelser tages senere mod officiel kilde.
update public.postcode p set city=v.c, municipality=v.m, region=v.r, region_ambiguous=v.a from (values
(2800,'Kongens Lyngby','Gentofte','Region Hovedstaden',false),
(3200,'Helsinge','Hillerød','Region Hovedstaden',false),
(3230,'Græsted','Helsingør','Region Hovedstaden',false),
(3310,'Ølsted','Hillerød','Region Hovedstaden',false),
(3460,'Birkerød','Furesø','Region Hovedstaden',false),
(3500,'Værløse','Ballerup','Region Hovedstaden',false),
(3540,'Lynge','Furesø','Region Hovedstaden',false),
(3550,'Slangerup','Allerød','Region Hovedstaden',false),
(6830,'Nørre Nebel','Ringkøbing-Skjern','Region Midtjylland',true),
(6870,'Ølgod','Ringkøbing-Skjern','Region Midtjylland',true),
(7260,'Sønder Omme','Herning','Region Midtjylland',true),
(7270,'Stakroge','Herning','Region Midtjylland',true),
(7323,'Give','Ikast-Brande','Region Midtjylland',true),
(7830,'Vinderup','Herning','Region Midtjylland',false),
(8380,'Trige','Favrskov','Region Midtjylland',false),
(8471,'Sabro','Favrskov','Region Midtjylland',false),
(8641,'Sorring','Favrskov','Region Midtjylland',false),
(8654,'Bryrup','Horsens','Region Midtjylland',false),
(8680,'Ry','Horsens','Region Midtjylland',false),
(8840,'Rødkærsbro','Silkeborg','Region Midtjylland',false),
(8850,'Bjerringbro','Favrskov','Region Midtjylland',false),
(8870,'Langå','Favrskov','Region Midtjylland',false),
(8882,'Fårvang','Favrskov','Region Midtjylland',false),
(8963,'Auning','Syddjurs','Region Midtjylland',false),
(8970,'Havndal','Mariagerfjord','Region Nordjylland',true),
(8990,'Fårup','Mariagerfjord','Region Nordjylland',true),
(9230,'Svenstrup J','Rebild','Region Nordjylland',false),
(9240,'Nibe','Vesthimmerlands','Region Nordjylland',false),
(9260,'Gistrup','Rebild','Region Nordjylland',false),
(9370,'Hals','Brønderslev','Region Nordjylland',false),
(9381,'Sulsted','Jammerbugt','Region Nordjylland',false),
(9440,'Aabybro','Brønderslev','Region Nordjylland',false),
(9480,'Løkken','Brønderslev','Region Nordjylland',false),
(9500,'Hobro','Rebild','Region Nordjylland',true),
(9541,'Suldrup','Vesthimmerlands','Region Nordjylland',false),
(9560,'Hadsund','Rebild','Region Nordjylland',false),
(9610,'Nørager','Vesthimmerlands','Region Nordjylland',false),
(9632,'Møldrup','Mariagerfjord','Region Nordjylland',true),
(9750,'Østervrå','Brønderslev','Region Nordjylland',false),
(9760,'Vrå','Brønderslev','Region Nordjylland',false),
(9830,'Tårs','Frederikshavn','Region Nordjylland',false),
(9870,'Sindal','Frederikshavn','Region Nordjylland',false),
(9881,'Bindslev','Frederikshavn','Region Nordjylland',false)
) as v(pc,c,m,r,a) where p.postal_code=v.pc::text;
