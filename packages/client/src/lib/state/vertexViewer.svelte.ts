import { FileReference, Space, Vertex } from "@sila/core";

export default class VertexViewer {

  constructor(private space: Space) {
  }

  vertices: Vertex[] = $state([]);
  activeVertexIndex: number = $state(0);

  activeVertex: Vertex | undefined = $derived(this.vertices[this.activeVertexIndex]);

  openFileRef(fileRef: FileReference) {

    // @TODO: refactor this when we start storing space in "trees" of the space
    if (fileRef.tree === this.space.getId()) {
      const fileVertex = this.space.getVertex(fileRef.vertex);
      if (!fileVertex) {
        throw new Error(`File vertex not found: ${fileRef.vertex}`);
      }
      this.openVertex(fileVertex);
      return;
    }

    const fileVertex = this.space.getAppTree(fileRef.tree)?.tree.getVertex(fileRef.vertex);
    if (!fileVertex) {
      throw new Error(`File vertex not found: ${fileRef.vertex}`);
    }

    this.openVertex(fileVertex);
  }

  openVertex(vertex: Vertex) {
    this.vertices = [vertex];
  }

  openVertices(vertices: Vertex[], activeVertexIndex: number = 0) {
    if (vertices.length === 0) {
      throw new Error("Cannot open an empty list of vertices");
    }

    this.vertices = vertices;
    this.activeVertexIndex = activeVertexIndex;
  }

  close() {
    this.vertices = [];
    this.activeVertexIndex = 0;
  }

}