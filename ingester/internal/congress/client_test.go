package congress

import "testing"

func TestMatches(t *testing.T) {
	f := Filing{Last: "Pelosi", First: "Nancy", StateDst: "CA11"}
	if !Matches(f, "Pelosi", "CA11") {
		t.Fatal("expected pelosi CA11 match")
	}
	if Matches(f, "Pelosi", "CA12") {
		t.Fatal("district mismatch should fail")
	}
	if Matches(f, "Crenshaw", "CA11") {
		t.Fatal("last name mismatch should fail")
	}
	if !Matches(f, "pelosi", "ca11") {
		t.Fatal("matching should be case-insensitive")
	}
}
