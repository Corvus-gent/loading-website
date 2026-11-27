/ Counts for bins d=0,1,2,3,4 and >=5. Their sum is the sample size 100000.
/ Line 1: each bin's share of the samples, 4 decimals, halves rounded away from zero.
/ Line 2: 95% Wilson interval for P(d=0), using z=1.96. Low, then high, 6 decimals.
c:32 236 1109 3244 8323 87056
d:_(0.5+c%10)
fmt4:{s:$x;"0.",((4-#s)#"0"),s}
line1:" "/fmt4'10000!d
x:32.0
n:100000.0
z:1.96
ph:x%n
z2:z*z
den:1+(z2%n)
centre:(ph+(z2%(2*n)))%den
se:%(((ph*(1-ph))%n)+(z2%(4*n*n)))
marg:(z*se)%den
lo:centre-marg
hi:centre+marg
u:_(0.5+1000000*(lo;hi))
fmt6:{s:$x;"0.",((6-#s)#"0"),s}
line2:" "/fmt6'u
`0:(line1;line2)
