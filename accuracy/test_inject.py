import pandas as pd

from accuracy.inject import inject


def _clean(n_inv=12, n_days=34):
    return pd.DataFrame([
        {"date": pd.Timestamp("2020-05-15") + pd.Timedelta(d, "D"), "source_key": f"inv{i:02d}", "actual_kwh": 100.0}
        for i in range(n_inv) for d in range(n_days)
    ])


def test_same_seed_same_output():
    a, la = inject(_clean(), seed=7)
    b, lb = inject(_clean(), seed=7)
    pd.testing.assert_frame_equal(a, b)
    pd.testing.assert_frame_equal(la, lb)


def test_labels_match_changes():
    clean = _clean()
    faulty, labels = inject(clean)
    changed = faulty.merge(clean, on=["date", "source_key"], suffixes=("", "_orig"))
    changed = changed[changed["actual_kwh"] != changed["actual_kwh_orig"]]
    assert set(changed["source_key"]) == set(labels["source_key"])
    for _, lab in labels.iterrows():
        rows = changed[changed["source_key"] == lab.source_key]
        assert rows["date"].min() >= lab.start_date
        assert rows["date"].max() <= lab.end_date
        if lab.kind == "trip":
            assert (rows["actual_kwh"] == 0).all()
        if lab.kind == "step":
            assert (rows["actual_kwh"] == 80.0).all()


def test_about_a_third_stay_clean():
    _, labels = inject(_clean())
    assert len(labels) == 8
    assert set(labels["kind"]) == {"trip", "step", "dust"}
