# Validasi R (BASE R ONLY — no extra packages). Run: Rscript validate.R
# Reads bench_*.csv from this dir, writes r_outputs.csv (method, metric, value).
ev <- dirname(sys.frame(1)$ofile)
if (is.null(ev) || ev == "") ev <- getwd()
out <- data.frame(method=character(), metric=character(), value=numeric(), stringsAsFactors=FALSE)
emit <- function(method, metric, value) {
  out <<- rbind(out, data.frame(method=method, metric=metric, value=as.numeric(value)))
}

d <- read.csv(file.path(ev, "bench_descriptive.csv"))
emit("descriptive", "mean", mean(d$v)); emit("descriptive", "var", var(d$v))
emit("descriptive", "sd", sd(d$v)); emit("descriptive", "median", median(d$v))

n <- read.csv(file.path(ev, "bench_normality.csv"))
s <- shapiro.test(n$v_normal); emit("normality", "statistic", s$statistic); emit("normality", "p", s$p.value)

c <- read.csv(file.path(ev, "bench_corr.csv"))
p <- cor.test(c$x, c$y, method="pearson"); emit("pearson", "r", p$estimate); emit("pearson", "p", p$p.value)
emit("pearson", "ci_lo", p$conf.int[1]); emit("pearson", "ci_hi", p$conf.int[2])
sp <- cor.test(c$x, c$y, method="spearman"); emit("spearman", "rho", sp$estimate); emit("spearman", "p", sp$p.value)

o <- read.csv(file.path(ev, "bench_ttest_onesamp.csv"))
t1 <- t.test(o$v, mu=100); emit("ttest_1samp", "t", t1$statistic); emit("ttest_1samp", "p", t1$p.value)
emit("ttest_1samp", "ci_lo", t1$conf.int[1]); emit("ttest_1samp", "ci_hi", t1$conf.int[2])

i <- read.csv(file.path(ev, "bench_ttest_ind.csv"))
a <- i$v[i$g=="A"]; b <- i$v[i$g=="B"]
t2 <- t.test(a, b, var.equal=TRUE); emit("ttest_ind", "t", t2$statistic); emit("ttest_ind", "p", t2$p.value)
emit("ttest_ind", "ci_lo", t2$conf.int[1]); emit("ttest_ind", "ci_hi", t2$conf.int[2])
tw <- t.test(a, b, var.equal=FALSE); emit("ttest_ind_welch_ref", "t", tw$statistic); emit("ttest_ind_welch_ref", "p", tw$p.value)
mw <- wilcox.test(a, b); emit("mannwhitney_ref", "u_note", NA)  # placeholder, U computed below
# R reports W (= U of first group); record raw
emit("mannwhitney_ref", "w", mw$statistic); emit("mannwhitney_ref", "p", mw$p.value)

w <- read.csv(file.path(ev, "bench_ttest_welch.csv"))
aw <- w$v[w$g=="A"]; bw <- w$v[w$g=="B"]
tw2 <- t.test(aw, bw, var.equal=FALSE); emit("ttest_welch", "t", tw2$statistic); emit("ttest_welch", "p", tw2$p.value)

pr <- read.csv(file.path(ev, "bench_ttest_paired.csv"))
tp <- t.test(pr$pre, pr$post, paired=TRUE); emit("ttest_paired", "t", tp$statistic); emit("ttest_paired", "p", tp$p.value)
emit("ttest_paired", "ci_lo", tp$conf.int[1]); emit("ttest_paired", "ci_hi", tp$conf.int[2])
wx <- wilcox.test(pr$pre, pr$post, paired=TRUE); emit("wilcoxon_ref", "w", wx$statistic); emit("wilcoxon_ref", "p", wx$p.value)

an <- read.csv(file.path(ev, "bench_anova.csv"))
fit <- aov(v ~ g, data=an); s <- summary(fit)
emit("anova_oneway", "f", s[[1]]$`F value`[1]); emit("anova_oneway", "p", s[[1]]$`Pr(>F)`[1])
tk <- TukeyHSD(fit); emit("anova_oneway", "tukey_n", nrow(tk$g))
kw <- kruskal.test(v ~ g, data=an); emit("kruskal_ref", "h", kw$statistic); emit("kruskal_ref", "p", kw$p.value)

ch <- read.csv(file.path(ev, "bench_chi2.csv"))
ct <- table(ch$c1, ch$c2); c2 <- chisq.test(ct)
emit("chi2_independence", "chi2", c2$statistic); emit("chi2_independence", "p", c2$p.value)

g <- read.csv(file.path(ev, "bench_gof.csv"))
obs <- table(g$k); exp <- rep(sum(obs)/length(obs), length(obs))
g2 <- chisq.test(as.numeric(obs), p=exp/sum(exp))
emit("chi2_gof", "chi2", g2$statistic); emit("chi2_gof", "p", g2$p.value)

mw2 <- read.csv(file.path(ev, "bench_mannwhitney.csv"))
a2 <- mw2$v[mw2$g=="A"]; b2 <- mw2$v[mw2$g=="B"]
m2 <- wilcox.test(a2, b2); emit("mannwhitney", "w", m2$statistic); emit("mannwhitney", "p", m2$p.value)

wx2 <- read.csv(file.path(ev, "bench_wilcoxon.csv"))
w2 <- wilcox.test(wx2$pre, wx2$post, paired=TRUE); emit("wilcoxon", "w", w2$statistic); emit("wilcoxon", "p", w2$p.value)

kr <- read.csv(file.path(ev, "bench_kruskal.csv"))
k2 <- kruskal.test(v ~ g, data=kr); emit("kruskal", "h", k2$statistic); emit("kruskal", "p", k2$p.value)

rg <- read.csv(file.path(ev, "bench_regression.csv"))
m1 <- lm(y ~ x1, data=rg); sm <- summary(m1)
emit("linreg_simple", "b", coef(sm)["x1","Estimate"]); emit("linreg_simple", "r2", sm$r.squared)
m2 <- lm(y ~ x1 + x2, data=rg); sm2 <- summary(m2)
emit("linreg_multiple", "r2", sm2$r.squared); emit("linreg_multiple", "b_x1", coef(sm2)["x1","Estimate"])
# manual VIF (no car package): 1/(1-R2j)
v1 <- summary(lm(x1 ~ x2, data=rg))$r.squared; v2 <- summary(lm(x2 ~ x1, data=rg))$r.squared
emit("linreg_multiple", "vif_x1", 1/(1-v1)); emit("linreg_multiple", "vif_x2", 1/(1-v2))

write.csv(out, file.path(ev, "r_outputs.csv"), row.names=FALSE)
cat("wrote r_outputs.csv with", nrow(out), "rows\n")
